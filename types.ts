
export enum Role {
  ADMIN = 'ADMIN',     // Quản trị viên tối cao (Full quyền + Đồng bộ)
  MANAGER = 'MANAGER', // Quản lý (Vào được AdminPanel nhưng không được Đồng bộ)
  TEACHER = 'TEACHER'  // Giáo viên (Chỉ vào TeacherPanel)
}

export interface Lesson {
  id: string;
  subject: string; // Môn học
  grade: string;   // Khối lớp
  week: number;    // Tuần
  period: number;  // Tiết
  name: string;    // Tên bài
}

export interface ClassItem {
  id: string;
  grade: string; // Links to Lesson.grade
  name: string;  // e.g. 6A1, 9A2
}

export interface User {
  id: string;
  email: string;
  password?: string; // In a real app, hashed. Here plain for mock.
  name: string;
  role: Role;
  drawStartTime: string; // ISO Date string
  drawEndTime: string;   // ISO Date string
  hasDrawn: boolean;
  drawnLessonId?: string;
  drawnClass?: string;   // New: The random class assigned
  subjectGroup?: string; // Môn giảng dạy
}

export interface DrawRequest {
  teacherId: string;
  selectedGrades: string[]; // User selects 2 grades
}

export interface GoogleConfig {
  scriptUrl: string;
}

export interface AppSettings {
  subjects: string[];
  grades: string[];
  classes: ClassItem[];
}
