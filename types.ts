export enum Role {
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER'
}

export interface Lesson {
  id: string;
  subject: string; // Môn học
  grade: string;   // Khối lớp
  week: number;    // Tuần
  period: number;  // Tiết
  name: string;    // Tên bài
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
}