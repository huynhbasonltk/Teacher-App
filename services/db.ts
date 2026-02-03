
import { Lesson, User, Role, GoogleConfig, AppSettings, ClassItem } from '../types';

const DEFAULT_SUBJECTS = ["Toán", "Khoa học tự nhiên", "Lịch sử & Địa lí", "Tin Học", "Ngữ Văn", "Mĩ thuật", "Âm nhạc", "Tiếng Anh", "GDCD", "Giáo dục thể chất","Công nghệ", "HĐTN-HN"];
const DEFAULT_GRADES = ["Khối 6", "Khối 7", "Khối 8", "Khối 9"];

// Default Classes
const SEED_CLASSES: ClassItem[] = [
  { id: 'c-6a1', grade: 'Khối 6', name: '6A1' },
  { id: 'c-6a2', grade: 'Khối 6', name: '6A2' },
  { id: 'c-7a1', grade: 'Khối 7', name: '7A1' },
  { id: 'c-8a1', grade: 'Khối 8', name: '8A1' },
  { id: 'c-9a1', grade: 'Khối 9', name: '9A1' },
];

// Hardcoded Script URL provided by user
const HARDCODED_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyWxRpE_pC9hggF9Xq2Kpb13zvTFdjLkb3KIhw8CBhlEmjAbDpCizVqq8eBG7_pftGwFw/exec";

// Helper: Convert Date object to Local ISO String "YYYY-MM-DDTHH:mm"
const toLocalISOString = (d: Date) => {
  const pad = (num: number) => num.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Seed data
const SEED_LESSONS: Lesson[] = Array.from({ length: 50 }).map((_, i) => ({
  id: `lesson-${i}`,
  subject: DEFAULT_SUBJECTS[Math.floor(Math.random() * DEFAULT_SUBJECTS.length)],
  grade: DEFAULT_GRADES[Math.floor(Math.random() * DEFAULT_GRADES.length)],
  week: Math.floor(Math.random() * 4) + 1,
  period: Math.floor(Math.random() * 5) + 1,
  name: `Bài giảng mẫu số ${i + 1}: Chủ đề tự chọn nâng cao`
}));

const SEED_USERS: User[] = [
  {
    id: 'admin-1',
    email: 'admin@edu.vn',
    password: 'admin',
    name: 'Quản Trị Viên',
    role: Role.ADMIN,
    drawStartTime: toLocalISOString(new Date()),
    drawEndTime: toLocalISOString(new Date()),
    hasDrawn: false
  }
];

const STORAGE_KEYS = {
  USERS: 'app_users',
  LESSONS: 'app_lessons',
  CURRENT_USER: 'app_current_user',
  GOOGLE_CONFIG: 'app_google_config',
  SETTINGS: 'app_settings'
};

export const db = {
  init: () => {
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(SEED_USERS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.LESSONS)) {
      localStorage.setItem(STORAGE_KEYS.LESSONS, JSON.stringify(SEED_LESSONS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
      const defaultSettings: AppSettings = {
        subjects: DEFAULT_SUBJECTS,
        grades: DEFAULT_GRADES,
        classes: SEED_CLASSES
      };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(defaultSettings));
    } else {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
      if (!s.classes) {
        s.classes = SEED_CLASSES;
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(s));
      }
    }
    db.saveGoogleConfig({ scriptUrl: HARDCODED_SCRIPT_URL });
  },

  getSettings: (): AppSettings => {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
    if (!s.classes) s.classes = [];
    return s;
  },

  saveSettings: (settings: AppSettings) => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  getUsers: (): User[] => {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
  },

  setUsers: (users: User[]) => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },

  addUser: async (user: User): Promise<void> => {
    const users = db.getUsers();
    if (users.some(u => u.email === user.email)) {
      throw new Error("Email đã tồn tại trong hệ thống.");
    }
    users.push(user);
    db.setUsers(users);
    await db.syncUserToGoogle(user, 'addUser');
  },

  syncUserToGoogle: async (user: User, action: 'updateUser' | 'addUser' = 'updateUser'): Promise<void> => {
    const scriptUrl = HARDCODED_SCRIPT_URL;

    if (scriptUrl) {
      if (!navigator.onLine) {
         if (action === 'addUser') throw new Error("Đã lưu vào máy nhưng không có mạng để đồng bộ Google Sheet.");
         return; 
      }
      
      try {
        const payloadUser = { ...user };
        // Ensure format "YYYY-MM-DD HH:mm" for Sheet
        payloadUser.drawStartTime = user.drawStartTime.replace('T', ' ');
        payloadUser.drawEndTime = user.drawEndTime.replace('T', ' ');

        await fetch(scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify({
            action: action,
            data: payloadUser
          }),
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        });
      } catch (err: any) {
        console.error("Sync user update failed", err);
        if (action === 'addUser') throw new Error("Đã lưu vào máy nhưng LỖI đồng bộ Google Sheet: " + (err.message || "Lỗi kết nối"));
        throw new Error("Lỗi khi đồng bộ cập nhật lên Google Sheet.");
      }
    }
  },

  updateUser: (updatedUser: User) => {
    const users = db.getUsers();
    const index = users.findIndex(u => u.id === updatedUser.id);
    if (index !== -1) {
      users[index] = updatedUser;
      db.setUsers(users);
      
      const currentUser = db.getCurrentUser();
      if (currentUser && currentUser.id === updatedUser.id) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
      }
    }
  },

  deleteUser: (id: string) => {
    let users = db.getUsers();
    users = users.filter(u => u.id !== id);
    db.setUsers(users);
  },

  getLessons: (): Lesson[] => {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.LESSONS) || '[]');
  },

  setLessons: (lessons: Lesson[]) => {
    localStorage.setItem(STORAGE_KEYS.LESSONS, JSON.stringify(lessons));
  },

  getLessonById: (id: string): Lesson | undefined => {
    const lessons = db.getLessons();
    return lessons.find(l => l.id === id);
  },

  login: (email: string, password: string): User | null => {
    const users = db.getUsers();
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      return user;
    }
    return null;
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  },

  getCurrentUser: (): User | null => {
    const u = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return u ? JSON.parse(u) : null;
  },

  getGoogleConfig: (): GoogleConfig | null => {
    return { scriptUrl: HARDCODED_SCRIPT_URL };
  },

  saveGoogleConfig: (config: GoogleConfig) => {
    localStorage.setItem(STORAGE_KEYS.GOOGLE_CONFIG, JSON.stringify(config));
  },

  // Sync Data from Google Apps Script Web App
  syncFromGoogle: async (config: GoogleConfig): Promise<{ userCount: number, lessonCount: number, classCount: number }> => {
    const scriptUrl = HARDCODED_SCRIPT_URL;

    if (!scriptUrl) throw new Error("Lỗi cấu hình hệ thống (Thiếu Script URL).");

    try {
      const res = await fetch(scriptUrl);
      
      if (!res.ok) {
        throw new Error(`Lỗi kết nối: ${res.statusText}`);
      }

      const data = await res.json();
      
      if (!data.users || !data.lessons) {
        throw new Error("Dữ liệu trả về không đúng định dạng.");
      }

      // 1. Process Lessons
      const newLessons: Lesson[] = [];
      if (Array.isArray(data.lessons)) {
        data.lessons.forEach((row: any[], index: number) => {
          if (!row || row.length < 5) return;
          newLessons.push({
            id: `imported-lesson-${index}`,
            subject: String(row[0]),
            grade: String(row[1]),
            week: parseInt(row[2]) || 1,
            period: parseInt(row[3]) || 1,
            name: String(row[4])
          });
        });
      }

      // 2. Process Classes
      const newClasses: ClassItem[] = [];
      if (data.classes && Array.isArray(data.classes)) {
         data.classes.forEach((row: any[], index: number) => {
            if (!row || row.length < 2) return;
            newClasses.push({
               id: `imported-class-${index}`,
               grade: String(row[0]).trim(),
               name: String(row[1]).trim()
            });
         });
      }

      // 3. Process Users
      const newUsers: User[] = [];
      if (Array.isArray(data.users)) {
        data.users.forEach((row: any[], index: number) => {
           if (!row || row.length < 2) return; 
           
           // --- STRICT DATE PARSING ---
           // We expect the GAS to return a string "YYYY-MM-DD HH:mm". 
           // We simply convert " " to "T" to make it "YYYY-MM-DDTHH:mm".
           // This string is what input[type="datetime-local"] needs.
           // We do NOT use new Date() parsing here to avoid timezone shifts.
           
           const normalizeDateStr = (val: any, fallback: Date): string => {
               if (!val) return toLocalISOString(fallback);
               const str = String(val).trim();
               
               // If it's already ISO format from JSON (e.g. 2024-10-20T08:00:00.000Z)
               // This happens if GAS returns a Date object.
               // We try to extract the YYYY-MM-DDTHH:mm part but this is risky if Z is present.
               // IDEALLY: GAS should return a formatted string.
               
               // Handle standard format "YYYY-MM-DD HH:mm"
               if (str.match(/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/)) {
                   return str.replace(' ', 'T').substring(0, 16);
               }
               
               // Handle ISO with T
               if (str.includes('T')) {
                   return str.substring(0, 16);
               }

               // Fallback
               return toLocalISOString(fallback);
           };

           const roleStr = String(row[3]).toUpperCase().trim();
           let role = Role.TEACHER;
           if (roleStr === 'ADMIN') role = Role.ADMIN;
           else if (roleStr === 'MANAGER') role = Role.MANAGER;

           newUsers.push({
             id: `imported-user-${index}`,
             name: String(row[0] || 'Chưa đặt tên'),
             email: String(row[1]),
             password: String(row[2] || '123'),
             role: role,
             subjectGroup: String(row[4] || ''),
             // Use column 5 and 6 directly as strings
             drawStartTime: normalizeDateStr(row[5], new Date()),
             drawEndTime: normalizeDateStr(row[6], new Date(Date.now() + 86400000)),
             hasDrawn: false,
             drawnClass: '',
             drawnLessonId: undefined
           });

           // Link Draw Status
           const currentUser = newUsers[newUsers.length - 1];
           const hasDrawnRaw = String(row[7] || '').toUpperCase();
           if (hasDrawnRaw === 'TRUE' || hasDrawnRaw === 'ĐÃ BỐC' || hasDrawnRaw === 'YES') {
              currentUser.hasDrawn = true;
              currentUser.drawnClass = String(row[11] || ''); 
              const lSubject = String(row[8] || '');
              const lGrade = String(row[9] || '');
              const lName = String(row[10] || '');
              const lWeek = parseInt(row[12]);
              const lPeriod = parseInt(row[13]);
              
              const foundLesson = newLessons.find(l => 
                  l.subject === lSubject && l.grade === lGrade && 
                  l.name === lName && l.week === lWeek && l.period === lPeriod
              );
              if (foundLesson) currentUser.drawnLessonId = foundLesson.id;
           }
        });
      }

      if (newUsers.length === 0 && newLessons.length === 0) {
        throw new Error("Dữ liệu từ Script rỗng.");
      }

      // Ensure Admin
      if (!newUsers.some(u => u.role === Role.ADMIN)) {
        newUsers.unshift({
          id: 'admin-fallback',
          email: 'admin@edu.vn',
          password: 'admin',
          name: 'Quản Trị Viên (Mặc định)',
          role: Role.ADMIN,
          drawStartTime: toLocalISOString(new Date()),
          drawEndTime: toLocalISOString(new Date()),
          hasDrawn: false
        });
      }

      db.setUsers(newUsers);
      db.setLessons(newLessons);
      
      const currentSettings = db.getSettings();
      if (newClasses.length > 0) {
          currentSettings.classes = newClasses;
          db.saveSettings(currentSettings);
      }

      const currentUserSession = db.getCurrentUser();
      if (currentUserSession) {
        const updatedUser = newUsers.find(u => u.email === currentUserSession.email);
        if (updatedUser) {
           localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
        }
      }

      return { userCount: newUsers.length, lessonCount: newLessons.length, classCount: newClasses.length };

    } catch (error: any) {
      console.error("Sync Error:", error);
      throw new Error(error.message || "Lỗi không xác định khi đồng bộ từ Apps Script.");
    }
  },

  resetDraw: async (userId: string): Promise<void> => {
    const user = db.getUsers().find(u => u.id === userId);
    if (!user) throw new Error("User not found");
    user.hasDrawn = false;
    delete user.drawnLessonId; 
    delete user.drawnClass;    
    db.updateUser(user);
    await db.syncUserToGoogle(user);
  },

  drawLesson: async (teacherId: string, selectedGrades: string[]): Promise<{ lesson: Lesson, className: string } | null> => {
    const user = db.getUsers().find(u => u.id === teacherId);
    if (!user) throw new Error("User not found");
    if (user.hasDrawn) throw new Error("Giáo viên đã bốc thăm rồi.");
    
    // Strict comparison using simple string formatting for local time
    // We compare "YYYY-MM-DDTHH:mm" strings directly if possible, or convert clean strings to dates
    const now = new Date();
    // Start/End are already "YYYY-MM-DDTHH:mm" (Local)
    // We create a Date object from them. 
    // IMPORTANT: new Date("2024-10-20T08:00") creates a date at 08:00 LOCAL DEVICE TIME.
    // This is correct because we want to compare against 'now' which is also LOCAL DEVICE TIME.
    const start = new Date(user.drawStartTime);
    const end = new Date(user.drawEndTime);
    
    if (now < start || now > end) {
      throw new Error("Không nằm trong khung giờ được phép bốc thăm.");
    }

    const allLessons = db.getLessons();
    const allUsers = db.getUsers();
    const settings = db.getSettings();
    const allClasses = settings.classes || [];
    
    const slotUsage: Record<string, number> = {};
    allUsers.forEach(u => {
      if (u.hasDrawn && u.drawnLessonId) {
        const drawnLesson = allLessons.find(al => al.id === u.drawnLessonId);
        if (drawnLesson) {
          const signature = `${drawnLesson.subject}-${drawnLesson.grade}-${drawnLesson.week}-${drawnLesson.period}`;
          slotUsage[signature] = (slotUsage[signature] || 0) + 1;
        }
      }
    });

    const candidates = allLessons.filter(lesson => {
      const matchGrade = selectedGrades.includes(lesson.grade);
      const matchSubject = user.subjectGroup ? lesson.subject === user.subjectGroup : true;
      return matchGrade && matchSubject;
    });

    if (candidates.length === 0) return null;

    let finalPool = candidates.filter(lesson => {
      const signature = `${lesson.subject}-${lesson.grade}-${lesson.week}-${lesson.period}`;
      return !slotUsage[signature];
    });

    if (finalPool.length === 0) {
      const MAX_USAGE_TOLERANCE = 2; 
      finalPool = candidates.filter(lesson => {
        const signature = `${lesson.subject}-${lesson.grade}-${lesson.week}-${lesson.period}`;
        return (slotUsage[signature] || 0) < MAX_USAGE_TOLERANCE;
      });
    }

    if (finalPool.length === 0) return null;

    const selectedLesson = finalPool[Math.floor(Math.random() * finalPool.length)];

    const validClasses = allClasses.filter(c => c.grade === selectedLesson.grade);
    let selectedClassName = validClasses.length > 0 
        ? validClasses[Math.floor(Math.random() * validClasses.length)].name 
        : 'Chưa xếp lớp';

    user.hasDrawn = true;
    user.drawnLessonId = selectedLesson.id;
    user.drawnClass = selectedClassName;
    db.updateUser(user);

    const scriptUrl = HARDCODED_SCRIPT_URL;
    if (scriptUrl) {
      try {
        await fetch(scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify({
            action: 'updateDraw',
            email: user.email,
            lesson: { ...selectedLesson, week: selectedLesson.week || 0 },
            className: selectedClassName,
            timestamp: now.toLocaleString('vi-VN')
          }),
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        });
      } catch (err) {
        console.error("Sync draw result failed", err);
      }
    }

    return { lesson: selectedLesson, className: selectedClassName };
  }
};
