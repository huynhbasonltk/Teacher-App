import React, { useState, useEffect, useRef } from 'react';
import { User, Lesson, Role, AppSettings } from '../types';
import { db } from '../services/db';
import { Calendar, CheckCircle, Clock, User as UserIcon, Plus, X, Save, Database, Download, FileSpreadsheet, Settings, Trash2, Layers, Book, Copy, Terminal, FileDown, Upload, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import.meta.env.VITE_SCRIPT_URL;

export const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'config'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ subjects: [], grades: [] });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // New state for saving user specifically
  const [isSavingUser, setIsSavingUser] = useState(false);
  
  // File Input Ref for Import
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Google Config State
  const [googleConfig, setGoogleConfig] = useState({
    scriptUrl: ''
  });

  // New User Form State
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    subjectGroup: '',
    drawStartTime: '',
    drawEndTime: ''
  });

  // Config Input State
  const [newSubject, setNewSubject] = useState('');
  const [newGrade, setNewGrade] = useState('');
  
  // Refresh data
  const refresh = () => {
    setUsers(db.getUsers());
    setLessons(db.getLessons());
    setSettings(db.getSettings());
    const config = db.getGoogleConfig();
    if (config) setGoogleConfig(config);
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (settings.subjects.length > 0 && !newUser.subjectGroup) {
      setNewUser(prev => ({ ...prev, subjectGroup: settings.subjects[0] }));
    }
  }, [settings.subjects]);

  const handleTimeChange = (userId: string, field: 'drawStartTime' | 'drawEndTime', value: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      const updated = { ...user, [field]: value };
      db.updateUser(updated);
      refresh();
    }
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa giáo viên "${userName}" không? Hành động này không thể hoàn tác.`)) {
      try {
        db.deleteUser(userId);
        refresh();
        setSuccess(`Đã xóa giáo viên ${userName} thành công.`);
      } catch (e: any) {
        setError(e.message || "Không thể xóa giáo viên.");
      }
    }
  };

  const getLessonName = (id?: string) => {
    if (!id) return "Chưa bốc";
    const l = lessons.find(lx => lx.id === id);
    return l ? `${l.name} (${l.grade} - ${l.subject})` : "Không tìm thấy bài";
  };

  const handleSyncGoogle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const result = await db.syncFromGoogle(googleConfig);
      setSuccess(`Đồng bộ thành công! Đã tải ${result.userCount} giáo viên và ${result.lessonCount} bài học.`);
      setIsConfigOpen(false);
      refresh();
    } catch (err: any) {
      setError(err.message || "Lỗi khi kết nối Google Sheet.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- EXCEL IMPORT LOGIC ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      // Use raw parsing to get strings primarily
      const workbook = XLSX.read(data);
      
      let importedLessonsCount = 0;
      let importedUsersCount = 0;

      // 1. Parse Lessons (Looking for 'Lessons' or 'BaiDay' sheet)
      const lessonSheetName = workbook.SheetNames.find(n => 
        n.toLowerCase() === 'lessons' || n.toLowerCase().includes('bài')
      );
      
      if (lessonSheetName) {
        const ws = workbook.Sheets[lessonSheetName];
        const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        // Remove header row
        if (jsonData.length > 0) jsonData.shift();

        const newLessons: Lesson[] = jsonData
          .filter(row => row && row.length >= 5 && row[0]) // Basic validation: Must have subject
          .map((row, index) => ({
            id: `imported-excel-lesson-${Date.now()}-${index}`,
            subject: String(row[0] || '').trim(),
            grade: String(row[1] || '').trim(),
            week: parseInt(row[2]) || 1,
            period: parseInt(row[3]) || 1,
            name: String(row[4] || '').trim()
          }));

        if (newLessons.length > 0) {
          db.setLessons(newLessons);
          importedLessonsCount = newLessons.length;
        }
      }

      // 2. Parse Users (Looking for 'Users' or 'GiaoVien' sheet)
      const userSheetName = workbook.SheetNames.find(n => 
        n.toLowerCase() === 'users' || n.toLowerCase().includes('giáo')
      );

      if (userSheetName) {
         const ws = workbook.Sheets[userSheetName];
         const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
         if (jsonData.length > 0) jsonData.shift();

         const newUsers: User[] = [];
         
         jsonData.forEach((row, index) => {
            if (!row || row.length < 2 || !row[1]) return; // Must have email
            
            // Helper to parse potential Excel dates (which might be numbers) or strings
            const parseExcelDate = (val: any, defaultDate: Date): string => {
                if (!val) return defaultDate.toISOString();
                // If it's a number (Excel serial date), usually not handled by raw read unless we use cellDates:true
                // Assuming string format 'YYYY-MM-DD HH:mm' from template or ISO string
                const d = new Date(val);
                if (!isNaN(d.getTime())) return d.toISOString();
                return defaultDate.toISOString();
            };

            const roleStr = String(row[3] || '').trim().toUpperCase();

            newUsers.push({
              id: `imported-excel-user-${Date.now()}-${index}`,
              name: String(row[0]),
              email: String(row[1]),
              password: String(row[2] || '123'),
              role: roleStr === 'ADMIN' ? Role.ADMIN : Role.TEACHER,
              subjectGroup: String(row[4] || ''),
              drawStartTime: parseExcelDate(row[5], new Date()),
              drawEndTime: parseExcelDate(row[6], new Date(Date.now() + 86400000)),
              hasDrawn: false 
            });
         });

         // Ensure Admin exists
         if (!newUsers.some(u => u.role === Role.ADMIN)) {
            const currentAdmin = users.find(u => u.role === Role.ADMIN);
            if (currentAdmin) newUsers.unshift(currentAdmin);
            else {
                 newUsers.unshift({
                    id: 'admin-fallback',
                    email: 'admin@edu.vn',
                    password: 'admin',
                    name: 'Quản Trị Viên',
                    role: Role.ADMIN,
                    drawStartTime: new Date().toISOString(),
                    drawEndTime: new Date().toISOString(),
                    hasDrawn: false
                  });
            }
         }

         if (newUsers.length > 0) {
            db.setUsers(newUsers);
            importedUsersCount = newUsers.length;
         }
      }

      if (importedLessonsCount > 0 || importedUsersCount > 0) {
        setSuccess(`Nhập thành công: ${importedLessonsCount} bài dạy và ${importedUsersCount} người dùng.`);
        refresh();
      } else {
        setError("Không tìm thấy dữ liệu hợp lệ trong file (Kiểm tra tên Sheet 'Users' và 'Lessons').");
      }

    } catch (err: any) {
      console.error(err);
      setError("Lỗi khi đọc file Excel: " + err.message);
    } finally {
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const createExcelData = (userList: User[]) => {
    return userList.map(u => {
      const l = lessons.find(lx => lx.id === u.drawnLessonId);
      return {
        "Tên Giáo Viên": u.name,
        "Email": u.email,
        "Môn Giảng Dạy": u.subjectGroup || '',
        "Bắt đầu bốc thăm": new Date(u.drawStartTime).toLocaleString('vi-VN'),
        "Kết thúc bốc thăm": new Date(u.drawEndTime).toLocaleString('vi-VN'),
        "Trạng thái": u.hasDrawn ? "Đã bốc" : "Chưa bốc",
        "Tên Bài Dạy": l ? l.name : '',
        "Khối": l ? l.grade : '',
        "Tuần": l ? l.week : '',
        "Tiết": l ? l.period : ''
      };
    });
  };

  const handleExportExcel = () => {
    const exportData = createExcelData(users.filter(u => u.role !== Role.ADMIN));
    
    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    // Auto-width for columns (simple approximation)
    const wscols = [
      {wch: 20}, {wch: 25}, {wch: 15}, {wch: 20}, {wch: 20}, {wch: 10}, {wch: 40}, {wch: 10}, {wch: 8}, {wch: 8}
    ];
    worksheet['!cols'] = wscols;

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kết Quả Bốc Thăm");

    // Write file
    XLSX.writeFile(workbook, "ket_qua_boc_tham_tong_hop.xlsx");
  };

  const handleExportSingleUser = (user: User) => {
    const exportData = createExcelData([user]);

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const wscols = [
      {wch: 20}, {wch: 25}, {wch: 15}, {wch: 20}, {wch: 20}, {wch: 10}, {wch: 40}, {wch: 10}, {wch: 8}, {wch: 8}
    ];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kết Quả Chi Tiết");
    
    // Sanitize filename
    const safeName = user.name.replace(/[^a-z0-9\u00C0-\u1EF9]/gi, '_').toLowerCase();
    XLSX.writeFile(workbook, `ket_qua_${safeName}.xlsx`);
  };

  const handleDownloadTemplate = () => {
    // 1. Prepare Users Sheet
    // Added result columns so users know where data will appear
    const usersHeader = [
      "Tên giáo viên", "Email", "Mật khẩu", "Vai trò (ADMIN/TEACHER)", "Môn dạy", "Bắt đầu (YYYY-MM-DD HH:mm)", "Kết thúc (YYYY-MM-DD HH:mm)",
      "Trạng thái (KQ)", "Tên bài dạy (KQ)", "Khối (KQ)", "Tuần (KQ)", "Tiết (KQ)", "Thời gian bốc (KQ)"
    ];
    const usersSample = [
      ["Nguyễn Văn A", "gv1@demo.com", "123", "TEACHER", "Toán", "2024-10-20 07:00", "2024-10-25 17:00", "", "", "", "", "", ""],
      ["Admin User", "admin@demo.com", "admin", "ADMIN", "", "", "", "", "", "", "", "", ""]
    ];
    const wsUsers = XLSX.utils.aoa_to_sheet([usersHeader, ...usersSample]);
    wsUsers['!cols'] = [
      {wch: 20}, {wch: 25}, {wch: 10}, {wch: 15}, {wch: 10}, {wch: 20}, {wch: 20},
      {wch: 15}, {wch: 30}, {wch: 10}, {wch: 8}, {wch: 8}, {wch: 20}
    ];

    // 2. Prepare Lessons Sheet
    const lessonsHeader = ["Môn học", "Khối lớp", "Tuần", "Tiết", "Tên bài dạy"];
    const lessonsSample = [
      ["Toán", "Khối 6", 1, 1, "Bài 1: Tập hợp"],
      ["Ngữ Văn", "Khối 7", 2, 3, "Bài 2: Từ láy"]
    ];
    const wsLessons = XLSX.utils.aoa_to_sheet([lessonsHeader, ...lessonsSample]);
    wsLessons['!cols'] = [{wch: 15}, {wch: 10}, {wch: 8}, {wch: 8}, {wch: 40}];

    // 3. Create Workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, wsUsers, "Users");
    XLSX.utils.book_append_sheet(workbook, wsLessons, "Lessons");

    // 4. Download
    XLSX.writeFile(workbook, "mau_du_lieu_app_boc_tham.xlsx");
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSavingUser(true);

    if (!newUser.name || !newUser.email || !newUser.password || !newUser.drawStartTime || !newUser.drawEndTime) {
      setError("Vui lòng điền đầy đủ thông tin.");
      setIsSavingUser(false);
      return;
    }

    try {
      const userToAdd: User = {
        id: `teacher-${Date.now()}`,
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        role: Role.TEACHER,
        subjectGroup: newUser.subjectGroup,
        drawStartTime: newUser.drawStartTime,
        drawEndTime: newUser.drawEndTime,
        hasDrawn: false
      };
      
      await db.addUser(userToAdd);
      
      setNewUser({
        name: '',
        email: '',
        password: '',
        subjectGroup: settings.subjects[0] || '',
        drawStartTime: '',
        drawEndTime: ''
      });
      setIsModalOpen(false);
      refresh();
      setSuccess("Thêm giáo viên thành công!");
    } catch (err: any) {
      if (err.message && err.message.includes("đồng bộ")) {
        // This is a partial success (saved locally, failed sync)
        setNewUser({
          name: '',
          email: '',
          password: '',
          subjectGroup: settings.subjects[0] || '',
          drawStartTime: '',
          drawEndTime: ''
        });
        setIsModalOpen(false);
        refresh();
        setSuccess(`Đã lưu giáo viên nhưng: ${err.message}`);
      } else {
        setError(err.message || "Có lỗi xảy ra.");
      }
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleAddConfig = (type: 'subject' | 'grade') => {
    const value = type === 'subject' ? newSubject.trim() : newGrade.trim();
    if (!value) return;

    const newSettings = { ...settings };
    if (type === 'subject') {
      if (!newSettings.subjects.includes(value)) {
        newSettings.subjects.push(value);
        setNewSubject('');
      }
    } else {
      if (!newSettings.grades.includes(value)) {
        newSettings.grades.push(value);
        setNewGrade('');
      }
    }
    db.saveSettings(newSettings);
    refresh();
  };

  const handleRemoveConfig = (type: 'subject' | 'grade', value: string) => {
    const newSettings = { ...settings };
    if (type === 'subject') {
      newSettings.subjects = newSettings.subjects.filter(s => s !== value);
    } else {
      newSettings.grades = newSettings.grades.filter(g => g !== value);
    }
    db.saveSettings(newSettings);
    refresh();
  };

  const handleKeyDown = (e: React.KeyboardEvent, type: 'subject' | 'grade') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddConfig(type);
    }
  };

  // Updated GAS Code with doPost to handle adding users AND updating results
  const GAS_CODE = `function doGet() {
  return handleRequest();
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var userSheet = ss.getSheetByName("Users");
    var lessonSheet = ss.getSheetByName("Lessons");

    // Handle POST (Add User OR Update Result)
    if (e && e.postData && e.postData.contents) {
      var data = JSON.parse(e.postData.contents);
      
      // Action: Add New User
      if (data.action === 'addUser') {
        var u = data.data;
        userSheet.appendRow([
          u.name, 
          u.email, 
          u.password, 
          u.role, 
          u.subjectGroup, 
          formatDate(new Date(u.drawStartTime)), 
          formatDate(new Date(u.drawEndTime))
        ]);
        return successResponse();
      }

      // Action: Update Draw Result
      if (data.action === 'updateDraw') {
        var email = data.email;
        var lesson = data.lesson;
        var timestamp = data.timestamp;
        
        var usersData = userSheet.getDataRange().getValues();
        // Skip header, find row by email (index 1)
        for (var i = 1; i < usersData.length; i++) {
          if (usersData[i][1] === email) {
            // Update columns H, I, J, K, L, M (1-indexed: 8,9,10,11,12,13)
            // Note: getRange is 1-based. Row i+1 because data is 0-based but matches row i+1
            var row = i + 1;
            userSheet.getRange(row, 8).setValue("Đã bốc");
            userSheet.getRange(row, 9).setValue(lesson.name);
            userSheet.getRange(row, 10).setValue(lesson.grade);
            userSheet.getRange(row, 11).setValue(lesson.week);
            userSheet.getRange(row, 12).setValue(lesson.period);
            userSheet.getRange(row, 13).setValue(formatDate(new Date(timestamp)));
            return successResponse();
          }
        }
        return errorResponse("User email not found");
      }
    }

    // Handle GET (Read Data)
    var users = userSheet ? userSheet.getDataRange().getValues() : [];
    var lessons = lessonSheet ? lessonSheet.getDataRange().getValues() : [];

    if (users.length > 0) users.shift(); // Remove header
    if (lessons.length > 0) lessons.shift(); // Remove header

    var result = {
      users: users,
      lessons: lessons
    };

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return errorResponse(err.toString());
  } finally {
    lock.releaseLock();
  }
}

function successResponse() {
  return ContentService.createTextOutput(JSON.stringify({result: "success"}))
          .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(msg) {
  return ContentService.createTextOutput(JSON.stringify({result: "error", error: msg}))
      .setMimeType(ContentService.MimeType.JSON);
}

function formatDate(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
}`;

  const copyCode = () => {
    navigator.clipboard.writeText(GAS_CODE);
    alert("Đã sao chép mã Script!");
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 relative">
      {success && (
        <div className={`
          border px-4 py-3 rounded-lg flex items-center gap-2 animate-fade-in
          ${success.includes("LỖI") ? "bg-amber-100 border-amber-200 text-amber-800" : "bg-green-100 border-green-200 text-green-800"}
        `}>
          {success.includes("LỖI") ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          {success}
          <button onClick={() => setSuccess('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <header className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Quản Trị Hệ Thống</h1>
          <p className="text-slate-500">Quản lý giáo viên, cấu hình và thời gian bốc thăm</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setIsConfigOpen(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg shadow-sm font-medium transition-colors"
          >
            <Database className="w-4 h-4" />
            Đồng bộ Sheet
          </button>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-lg shadow-sm font-medium transition-colors"
          >
            <Upload className="w-4 h-4" />
            Nhập Excel
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".xlsx, .xls" 
            className="hidden" 
          />

          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-lg shadow-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Xuất Tổng Hợp
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg shadow-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Thêm Giáo Viên
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('users')}
            className={`
              whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors
              ${activeTab === 'users'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}
            `}
          >
            <UserIcon className="w-4 h-4" />
            Quản lý Giáo viên
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`
              whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors
              ${activeTab === 'config'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}
            `}
          >
            <Settings className="w-4 h-4" />
            Cấu hình chung (Môn/Khối)
          </button>
        </nav>
      </div>

      {activeTab === 'users' ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 uppercase font-medium">
                <tr>
                  <th className="px-6 py-4">Giáo viên</th>
                  <th className="px-6 py-4">Môn dạy</th>
                  <th className="px-6 py-4">Khung giờ bốc thăm</th>
                  <th className="px-6 py-4">Trạng thái</th>
                  <th className="px-6 py-4">Kết quả bốc thăm</th>
                  <th className="px-6 py-4 w-24">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.filter(u => u.role !== 'ADMIN').map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      <div>{user.name}</div>
                      <div className="text-xs text-slate-400 font-normal">{user.email}</div>
                    </td>
                    <td className="px-6 py-4">{user.subjectGroup || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs w-14 text-slate-400">Bắt đầu:</span>
                          <input 
                            type="datetime-local" 
                            className="border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                            value={user.drawStartTime.substring(0, 16)}
                            onChange={(e) => handleTimeChange(user.id, 'drawStartTime', e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs w-14 text-slate-400">Kết thúc:</span>
                          <input 
                            type="datetime-local" 
                            className="border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                            value={user.drawEndTime.substring(0, 16)}
                            onChange={(e) => handleTimeChange(user.id, 'drawEndTime', e.target.value)}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       {user.hasDrawn ? (
                         <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                           <CheckCircle className="w-3 h-3" />
                           Đã bốc
                         </span>
                       ) : (
                         <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                           <Clock className="w-3 h-3" />
                           Chưa bốc
                         </span>
                       )}
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate" title={getLessonName(user.drawnLessonId)}>
                      {getLessonName(user.drawnLessonId)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleExportSingleUser(user)}
                          className="text-slate-400 hover:text-green-600 transition-colors p-2 rounded-full hover:bg-green-50"
                          title="Xuất kết quả cá nhân (Excel)"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.name)}
                          className="text-slate-400 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-red-50"
                          title="Xóa giáo viên"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.filter(u => u.role !== 'ADMIN').length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">Chưa có dữ liệu giáo viên.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Subjects Config */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
              <Book className="w-5 h-5 text-indigo-500" />
              Danh sách Môn học
            </h3>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Nhập tên môn..."
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'subject')}
              />
              <button
                onClick={() => handleAddConfig('subject')}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Thêm
              </button>
            </div>
            <ul className="space-y-2 max-h-96 overflow-y-auto">
              {[...settings.subjects].sort().map((sub, idx) => (
                <li key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100 group hover:border-indigo-100 hover:bg-indigo-50/30 transition-colors">
                  <span className="text-slate-700 font-medium">{sub}</span>
                  <button
                    onClick={() => handleRemoveConfig('subject', sub)}
                    className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50"
                    title="Xóa môn học"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
              {settings.subjects.length === 0 && (
                <li className="text-center text-slate-400 py-4 text-sm">Chưa có môn học nào.</li>
              )}
            </ul>
          </div>

          {/* Grades Config */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
              <Layers className="w-5 h-5 text-orange-500" />
              Danh sách Khối lớp
            </h3>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Nhập tên khối..."
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                value={newGrade}
                onChange={(e) => setNewGrade(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'grade')}
              />
              <button
                onClick={() => handleAddConfig('grade')}
                className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
              >
                Thêm
              </button>
            </div>
            <ul className="space-y-2 max-h-96 overflow-y-auto">
              {[...settings.grades].sort().map((g, idx) => (
                <li key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100 group hover:border-orange-100 hover:bg-orange-50/30 transition-colors">
                  <span className="text-slate-700 font-medium">{g}</span>
                  <button
                    onClick={() => handleRemoveConfig('grade', g)}
                    className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50"
                    title="Xóa khối lớp"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
              {settings.grades.length === 0 && (
                <li className="text-center text-slate-400 py-4 text-sm">Chưa có khối lớp nào.</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Google Config Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden h-auto max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                Kết nối Google Apps Script
              </h3>
              <button 
                onClick={() => setIsConfigOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Left Column: Instructions */}
              <div className="space-y-4 text-sm">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-blue-800">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold flex items-center gap-2">
                      <Terminal className="w-4 h-4" />
                      Bước 1: Tạo Dữ Liệu
                    </h4>
                    <button 
                      onClick={handleDownloadTemplate}
                      className="flex items-center gap-1 bg-white border border-blue-200 text-blue-700 px-2 py-1 rounded text-xs hover:bg-blue-50 transition-colors"
                      title="Tải file Excel mẫu về máy"
                    >
                      <FileDown className="w-3 h-3" /> Tải mẫu
                    </button>
                  </div>
                  <p className="mb-2">1. Tải file mẫu ở trên về máy.</p>
                  <p className="mb-2">2. Upload lên <strong>Google Drive</strong> và mở dưới dạng Google Sheet.</p>
                  <p>3. Vào <strong>Tiện ích mở rộng {'>'} Apps Script</strong>.</p>
                </div>

                <div className="bg-slate-800 text-slate-200 p-4 rounded-lg font-mono text-xs overflow-auto relative group">
                  <button 
                    onClick={copyCode}
                    className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 p-1.5 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Sao chép"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <pre>{GAS_CODE}</pre>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-blue-800">
                  <h4 className="font-bold mb-2">Bước 2: Triển khai (Deploy)</h4>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>Dán mã trên vào Script Editor.</li>
                    <li>Nhấn nút <strong>Triển khai</strong> (Deploy) {'>'} <strong>Tùy chọn triển khai mới</strong>.</li>
                    <li>Chọn loại: <strong>Ứng dụng web</strong> (Web app).</li>
                    <li>Người có quyền truy cập: <strong>Bất kỳ ai</strong> (Anyone).</li>
                    <li>Nhấn <strong>Triển khai</strong> và copy URL được cấp.</li>
                  </ol>
                </div>
              </div>

              {/* Right Column: Form */}
              <div className="flex flex-col">
                <form onSubmit={handleSyncGoogle} className="space-y-6 flex-1">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Dán URL Web App vào đây:</label>
                    <input 
                      type="url"
                      required
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-sm"
                      value={googleConfig.scriptUrl}
                      onChange={(e) => setGoogleConfig({ scriptUrl: e.target.value})}
                    />
                    <p className="text-xs text-slate-500 mt-2">
                      * Lưu ý: Đảm bảo Google Sheet có 2 sheet tên là <strong>Users</strong> và <strong>Lessons</strong> đúng như file mẫu.
                    </p>
                  </div>

                  {error && (
                    <div className="p-4 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-start gap-2">
                      <span className="mt-0.5">⚠️</span>
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="mt-auto pt-4 flex gap-3">
                     <button type="button" onClick={() => setIsConfigOpen(false)} className="flex-1 py-3 border border-slate-300 rounded-lg text-slate-600 font-medium hover:bg-slate-50">Đóng</button>
                    <button type="submit" disabled={isLoading} className="flex-1 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 shadow-lg shadow-emerald-500/30 flex justify-center items-center gap-2">
                      {isLoading ? "Đang xử lý..." : "Lưu & Đồng bộ Ngay"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Teacher Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">Thêm Giáo Viên Mới</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Họ và Tên</label>
                <input type="text" required className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={newUser.name} onChange={(e) => setNewUser({...newUser, name: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input type="email" required className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu</label>
                  <input type="text" required className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} />
                </div>
              </div>

              <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Môn Giảng Dạy</label>
                 <select 
                   className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                   value={newUser.subjectGroup}
                   onChange={(e) => setNewUser({...newUser, subjectGroup: e.target.value})}
                 >
                   <option value="">Chọn môn học...</option>
                   {settings.subjects.map(sub => (
                     <option key={sub} value={sub}>{sub}</option>
                   ))}
                 </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bắt đầu bốc thăm</label>
                  <input type="datetime-local" required className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newUser.drawStartTime} onChange={(e) => setNewUser({...newUser, drawStartTime: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kết thúc bốc thăm</label>
                  <input type="datetime-local" required className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newUser.drawEndTime} onChange={(e) => setNewUser({...newUser, drawEndTime: e.target.value})} />
                </div>
              </div>

              {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">Hủy bỏ</button>
                <button type="submit" disabled={isSavingUser} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg flex justify-center items-center gap-2">
                  {isSavingUser ? "Đang lưu..." : <><Save className="w-4 h-4" /> Lưu Giáo Viên</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
