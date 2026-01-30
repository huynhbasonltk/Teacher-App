import { Lesson, User, Role, GoogleConfig, AppSettings } from '../types';

const DEFAULT_SUBJECTS = ["Toán", "Vật Lý", "Hóa Học", "Sinh Học", "Ngữ Văn", "Lịch Sử", "Địa Lý", "Tiếng Anh", "GDCD"];
const DEFAULT_GRADES = ["Khối 6", "Khối 7", "Khối 8", "Khối 9", "Khối 10", "Khối 11", "Khối 12"];

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
        grades: DEFAULT_GRADES
      };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(defaultSettings));
    }
  },

  getSettings: (): AppSettings => {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
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

    // 2. Google Sync (if configured)
    const config = db.getGoogleConfig();
    if (config && config.scriptUrl) {
      try {
        await fetch(config.scriptUrl, {
          method: 'POST',
          body: JSON.stringify({
            action: 'addUser',
            data: user
          }),
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
        });
      } catch (err) {
        console.error("Failed to sync user to Google Sheet", err);
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

  // Google Configuration
  getGoogleConfig: (): GoogleConfig | null => {
    const c = localStorage.getItem(STORAGE_KEYS.GOOGLE_CONFIG);
    return c ? JSON.parse(c) : null;
  },

  saveGoogleConfig: (config: GoogleConfig) => {
    localStorage.setItem(STORAGE_KEYS.GOOGLE_CONFIG, JSON.stringify(config));
  },

  // Sync Data from Google Apps Script Web App
  syncFromGoogle: async (config: GoogleConfig): Promise<{ userCount: number, lessonCount: number }> => {
    const { scriptUrl } = config;

    if (!scriptUrl) throw new Error("Vui lòng nhập đường dẫn Web App của Google Apps Script.");

    try {
      const res = await fetch(scriptUrl);
      
      if (!res.ok) {
        throw new Error(`Lỗi kết nối: ${res.statusText}`);
      }

      const data = await res.json();
      
      if (!data.users || !data.lessons) {
        throw new Error("Dữ liệu trả về không đúng định dạng (thiếu 'users' hoặc 'lessons').");
      }

      // Process Users
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

           // 0:Name, 1:Email, 2:Pass, 3:Role, 4:Subject, 5:Start, 6:End
           // Note: We ignore subsequent columns (Results) during import for simplicity, 
           // or we could parse them if we wanted two-way sync. For now, assume import is for config.
           newUsers.push({
             id: `imported-user-${index}`,
             name: String(row[0] || 'Chưa đặt tên'),
             email: String(row[1]),
             password: String(row[2] || '123'),
             role: (String(row[3]).toUpperCase().trim() === 'ADMIN') ? Role.ADMIN : Role.TEACHER,
             subjectGroup: String(row[4] || ''),
             drawStartTime: parseDate(row[5], new Date()),
             drawEndTime: parseDate(row[6], new Date(Date.now() + 86400000)),
             hasDrawn: false // Reset draw status on fresh sync, or we could add logic to parse it
           });
        });
      }

      // Process Lessons
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
      db.saveGoogleConfig(config);

      return { userCount: newUsers.length, lessonCount: newLessons.length };

    } catch (error: any) {
      console.error("Sync Error:", error);
      throw new Error(error.message || "Lỗi không xác định khi đồng bộ từ Apps Script.");
    }
  },

  // Core Logic: Random Draw (Now Async for Google Sync)
  drawLesson: async (teacherId: string, selectedGrades: string[]): Promise<Lesson | null> => {
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
    
    // Filter logic
    const eligibleLessons = allLessons.filter(lesson => {
      const matchGrade = selectedGrades.includes(lesson.grade);
      const matchSubject = user.subjectGroup ? lesson.subject === user.subjectGroup : true; 
      return matchGrade && matchSubject;
    });

    if (eligibleLessons.length === 0) {
      return null;
    }

    // Random selection
    const randomIndex = Math.floor(Math.random() * eligibleLessons.length);
    const selectedLesson = eligibleLessons[randomIndex];

    // 1. Save state locally
    user.hasDrawn = true;
    user.drawnLessonId = selectedLesson.id;
    db.updateUser(user);

    // 2. Sync result to Google Sheet (Fire and forget, or await?)
    // We await it but catch errors so UI doesn't break if internet is bad
    const config = db.getGoogleConfig();
    if (config && config.scriptUrl) {
      try {
        await fetch(config.scriptUrl, {
          method: 'POST',
          body: JSON.stringify({
            action: 'updateDraw',
            email: user.email,
            lesson: selectedLesson,
            timestamp: now.toISOString()
          }),
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
        });
      } catch (err) {
        console.error("Failed to sync draw result to Google Sheet", err);
        // Note: The local state is already saved, so we consider this a success for the user.
      }
    }

    return selectedLesson;
  }
};