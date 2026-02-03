
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
const HARDCODED_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzhkb_zgJL43J4SFz_pY8rAG7yO_r6y1ADTrbwJQbGYXDutGaNJPj4LAAY09pHCE5Nr/exec";

// Seed data to simulate Google Sheet import and Admin setup
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
    drawStartTime: new Date().toISOString(),
    drawEndTime: new Date().toISOString(),
    hasDrawn: false
  },
  {
    id: 'teacher-1',
    email: 'gv1@edu.vn',
    password: '123',
    name: 'Nguyễn Văn A',
    role: Role.TEACHER,
    // Active now (Start 1 hour ago, End in 2 hours)
    drawStartTime: new Date(Date.now() - 3600000).toISOString(),
    drawEndTime: new Date(Date.now() + 7200000).toISOString(), 
    hasDrawn: false,
    subjectGroup: 'Toán'
  },
  {
    id: 'teacher-2',
    email: 'gv2@edu.vn',
    password: '123',
    name: 'Trần Thị B',
    role: Role.TEACHER,
    // Future (Start tomorrow)
    drawStartTime: new Date(Date.now() + 86400000).toISOString(),
    drawEndTime: new Date(Date.now() + 90000000).toISOString(),
    hasDrawn: false,
    subjectGroup: 'Ngữ Văn'
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
      // Migration for existing data without classes
      const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
      if (!s.classes) {
        s.classes = SEED_CLASSES;
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(s));
      }
    }
    // Always save the hardcoded config on init to ensure consistency
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
    // 1. Local Validation & Save
    const users = db.getUsers();
    if (users.some(u => u.email === user.email)) {
      throw new Error("Email đã tồn tại trong hệ thống.");
    }
    users.push(user);
    db.setUsers(users);

    // 2. Google Sync (Always use hardcoded URL)
    const scriptUrl = HARDCODED_SCRIPT_URL;
    
    if (scriptUrl) {
      if (!navigator.onLine) {
        throw new Error("Đã lưu vào máy nhưng không có mạng để đồng bộ Google Sheet.");
      }

      try {
        await fetch(scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify({
            action: 'addUser',
            data: user
          }),
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
        });
      } catch (err: any) {
        throw new Error("Đã lưu vào máy nhưng LỖI đồng bộ Google Sheet: " + (err.message || "Lỗi kết nối"));
      }
    }
  },

  // Update user in LocalStorage AND Google Sheet
  syncUserToGoogle: async (user: User): Promise<void> => {
    const scriptUrl = HARDCODED_SCRIPT_URL;

    if (scriptUrl) {
      if (!navigator.onLine) return; // Silent fail if offline, user relies on local
      try {
        await fetch(scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify({
            action: 'updateUser',
            data: user
          }),
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        });
      } catch (err) {
        console.error("Sync user update failed", err);
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
      
      // Update session if it's the current user
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

  // Google Configuration - Always returns Hardcoded URL
  getGoogleConfig: (): GoogleConfig | null => {
    return { scriptUrl: HARDCODED_SCRIPT_URL };
  },

  saveGoogleConfig: (config: GoogleConfig) => {
    // We update local storage just in case, but code relies on const
    localStorage.setItem(STORAGE_KEYS.GOOGLE_CONFIG, JSON.stringify(config));
  },

  // Sync Data from Google Apps Script Web App
  syncFromGoogle: async (config: GoogleConfig): Promise<{ userCount: number, lessonCount: number, classCount: number }> => {
    const scriptUrl = HARDCODED_SCRIPT_URL; // Force usage

    if (!scriptUrl) throw new Error("Lỗi cấu hình hệ thống (Thiếu Script URL).");

    try {
      const res = await fetch(scriptUrl);
      
      if (!res.ok) {
        throw new Error(`Lỗi kết nối: ${res.statusText}`);
      }

      const data = await res.json();
      
      if (!data.users || !data.lessons) {
        throw new Error("Dữ liệu trả về không đúng định dạng (thiếu 'users' hoặc 'lessons').");
      }

      // 1. Process Lessons First (so we can link drawn lessons to users)
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

      // 3. Process Users and Link Draw Status
      const newUsers: User[] = [];
      if (Array.isArray(data.users)) {
        data.users.forEach((row: any[], index: number) => {
           if (!row || row.length < 2) return; 
           const parseDate = (dateStr: any, defaultDate: Date) => {
              if (!dateStr) return defaultDate.toISOString();
              const d = new Date(dateStr);
              if (!isNaN(d.getTime())) return d.toISOString();
              return defaultDate.toISOString();
           };

           const roleStr = String(row[3]).toUpperCase().trim();
           let role = Role.TEACHER;
           if (roleStr === 'ADMIN') role = Role.ADMIN;
           else if (roleStr === 'MANAGER') role = Role.MANAGER;

           // Sheet Columns (0-based index in array):
           // 0:Name, 1:Email, 2:Pass, 3:Role, 4:Subject, 5:Start, 6:End, 
           // 7:Status(H), 8:Sub(I), 9:Grd(J), 10:LesName(K), 11:Cls(L), 12:Wk(M), 13:Per(N), 14:Time(O)
           
           const hasDrawnRaw = String(row[7] || '').toUpperCase();
           const hasDrawn = hasDrawnRaw === 'TRUE' || hasDrawnRaw === 'ĐÃ BỐC' || hasDrawnRaw === 'YES';
           let drawnClass = '';
           let drawnLessonId = undefined;

           if (hasDrawn) {
             drawnClass = String(row[11] || ''); // Col L
             
             // Try to find the matching lesson object to set ID
             const lSubject = String(row[8] || '');
             const lGrade = String(row[9] || '');
             const lName = String(row[10] || '');
             const lWeek = parseInt(row[12]);
             const lPeriod = parseInt(row[13]);
             
             // Find match in newLessons
             const foundLesson = newLessons.find(l => 
                l.subject === lSubject &&
                l.grade === lGrade &&
                l.name === lName &&
                l.week === lWeek &&
                l.period === lPeriod
             );
             
             if (foundLesson) {
               drawnLessonId = foundLesson.id;
             }
           }

           newUsers.push({
             id: `imported-user-${index}`,
             name: String(row[0] || 'Chưa đặt tên'),
             email: String(row[1]),
             password: String(row[2] || '123'),
             role: role,
             subjectGroup: String(row[4] || ''),
             drawStartTime: parseDate(row[5], new Date()),
             drawEndTime: parseDate(row[6], new Date(Date.now() + 86400000)),
             hasDrawn: hasDrawn,
             drawnClass: drawnClass,
             drawnLessonId: drawnLessonId
           });
        });
      }

      if (newUsers.length === 0 && newLessons.length === 0) {
        throw new Error("Dữ liệu từ Script rỗng.");
      }

      if (!newUsers.some(u => u.role === Role.ADMIN)) {
        newUsers.unshift({
          id: 'admin-fallback',
          email: 'admin@edu.vn',
          password: 'admin',
          name: 'Quản Trị Viên (Mặc định)',
          role: Role.ADMIN,
          drawStartTime: new Date().toISOString(),
          drawEndTime: new Date().toISOString(),
          hasDrawn: false
        });
      }

      db.setUsers(newUsers);
      db.setLessons(newLessons);
      
      // Update Settings with new Classes
      const currentSettings = db.getSettings();
      // If we got classes from Google, overwrite local. If empty, keep local or empty.
      if (newClasses.length > 0) {
          currentSettings.classes = newClasses;
          db.saveSettings(currentSettings);
      }

      // CRITICAL: Update current session if the logged-in user was updated in this sync
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

  // Reset a user's draw status to allow them to draw again
  resetDraw: async (userId: string): Promise<void> => {
    const user = db.getUsers().find(u => u.id === userId);
    if (!user) throw new Error("User not found");

    // Reset local state
    user.hasDrawn = false;
    delete user.drawnLessonId; // Clear the ID
    delete user.drawnClass;    // Clear the Class
    db.updateUser(user);

    // Sync to Google
    // We reuse syncUserToGoogle which sends 'updateUser' action
    // We assume the script updates the 'hasDrawn' column to FALSE based on the payload
    await db.syncUserToGoogle(user);
  },

  // Core Logic: Random Draw (Async for Google Sync)
  drawLesson: async (teacherId: string, selectedGrades: string[]): Promise<{ lesson: Lesson, className: string } | null> => {
    const user = db.getUsers().find(u => u.id === teacherId);
    if (!user) throw new Error("User not found");
    if (user.hasDrawn) throw new Error("Giáo viên đã bốc thăm rồi.");
    
    // Validate Time
    const now = new Date();
    const start = new Date(user.drawStartTime);
    const end = new Date(user.drawEndTime);
    
    if (now < start || now > end) {
      throw new Error("Không nằm trong khung giờ được phép bốc thăm.");
    }

    const allLessons = db.getLessons();
    const allUsers = db.getUsers();
    const settings = db.getSettings();
    const allClasses = settings.classes || [];
    
    // --- COLLISION DETECTION LOGIC V2 (Tiered) ---
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

    // Filter valid candidates
    const candidates = allLessons.filter(lesson => {
      const matchGrade = selectedGrades.includes(lesson.grade);
      const matchSubject = user.subjectGroup ? lesson.subject === user.subjectGroup : true;
      return matchGrade && matchSubject;
    });

    if (candidates.length === 0) {
      return null;
    }

    // Strategy A: Usage = 0
    let finalPool = candidates.filter(lesson => {
      const signature = `${lesson.subject}-${lesson.grade}-${lesson.week}-${lesson.period}`;
      return !slotUsage[signature]; // Usage is 0 or undefined
    });

    // Strategy B: Fallback
    if (finalPool.length === 0) {
      const MAX_USAGE_TOLERANCE = 2; 
      finalPool = candidates.filter(lesson => {
        const signature = `${lesson.subject}-${lesson.grade}-${lesson.week}-${lesson.period}`;
        return (slotUsage[signature] || 0) < MAX_USAGE_TOLERANCE;
      });
    }

    if (finalPool.length === 0) {
      return null;
    }

    // Random selection of Lesson
    const randomIndex = Math.floor(Math.random() * finalPool.length);
    const selectedLesson = finalPool[randomIndex];

    // --- RANDOM CLASS SELECTION LOGIC ---
    // Rule: Pick a random class from the grade of the SELECTED lesson.
    // If the lesson is for "Khối 6", pick a random class from "Khối 6".
    const validClasses = allClasses.filter(c => c.grade === selectedLesson.grade);
    let selectedClassName = '';
    
    if (validClasses.length > 0) {
        const randomClassIndex = Math.floor(Math.random() * validClasses.length);
        selectedClassName = validClasses[randomClassIndex].name;
    } else {
        selectedClassName = 'Chưa xếp lớp'; // Fallback if no classes configured for this grade
    }

    // Save state locally
    user.hasDrawn = true;
    user.drawnLessonId = selectedLesson.id;
    user.drawnClass = selectedClassName;
    db.updateUser(user);

    // Sync result to Google Sheet (Always use hardcoded URL)
    const scriptUrl = HARDCODED_SCRIPT_URL;

    if (scriptUrl) {
      try {
        await fetch(scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify({
            action: 'updateDraw',
            email: user.email,
            lesson: {
              ...selectedLesson,
              week: selectedLesson.week || 0 // Explicitly sending week to ensure sheet column M is updated
            },
            className: selectedClassName, // Send Class
            timestamp: now.toLocaleString('vi-VN') // Send formatted time string for Sheet Column O
          }),
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
        });
      } catch (err) {
        console.error("Sync draw result failed", err);
      }
    }

    return { lesson: selectedLesson, className: selectedClassName };
  }
};
