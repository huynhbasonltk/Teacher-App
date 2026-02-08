
import React, { useState, useEffect, useRef } from 'react';
import { User, Lesson, Role, AppSettings } from '../types';
import { db } from '../services/db';
import { Calendar, CheckCircle, Clock, User as UserIcon, Plus, X, Save, Database, Download, FileSpreadsheet, Settings, Trash2, Layers, Book, Upload, AlertTriangle, Shield, ShieldOff, Lock, ChevronDown, RefreshCw, RotateCcw, Home, Zap, CheckSquare, Square, ToggleLeft, ToggleRight } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  currentUser: User;
}

export const AdminPanel: React.FC<Props> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'config'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ subjects: [], grades: [], classes: [] });
  
  // Selection State
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  const [isModalOpen, setIsModalOpen] = useState(false);
  // Bulk Update Modal State
  const [isBulkTimeModalOpen, setIsBulkTimeModalOpen] = useState(false);
  const [bulkStartTime, setBulkStartTime] = useState('');
  const [bulkEndTime, setBulkEndTime] = useState('');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [isSavingUser, setIsSavingUser] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    subjectGroup: '',
    drawStartTime: '',
    drawEndTime: ''
  });

  const [newSubject, setNewSubject] = useState('');
  const [newGrade, setNewGrade] = useState('');
  const [selectedGradeForClass, setSelectedGradeForClass] = useState('');
  const [newClassName, setNewClassName] = useState('');

  const isSuperAdmin = currentUser.role === Role.ADMIN;
  
  const refresh = () => {
    setUsers(db.getUsers());
    setLessons(db.getLessons());
    setSettings(db.getSettings());
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (settings.subjects.length > 0 && !newUser.subjectGroup) {
      setNewUser(prev => ({ ...prev, subjectGroup: settings.subjects[0] }));
    }
  }, [settings.subjects]);
  
  useEffect(() => {
    if (settings.grades.length > 0 && !selectedGradeForClass) {
        setSelectedGradeForClass(settings.grades[0]);
    }
  }, [settings.grades]);

  // --- SELECTION LOGIC ---
  const teachers = users.filter(u => u.role !== Role.ADMIN);

  const handleSelectAll = () => {
    if (selectedUserIds.size === teachers.length) {
      setSelectedUserIds(new Set()); // Deselect all
    } else {
      setSelectedUserIds(new Set(teachers.map(u => u.id))); // Select all
    }
  };

  const handleSelectUser = (id: string) => {
    const newSelection = new Set(selectedUserIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedUserIds(newSelection);
  };

  const handleTimeChange = async (userId: string, field: 'drawStartTime' | 'drawEndTime', value: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      const updated = { ...user, [field]: value };
      db.updateUser(updated); // Local optimistic
      refresh();

      if (isSuperAdmin && db.getGoogleConfig()?.scriptUrl) {
         try {
           await db.syncUserToGoogle(updated);
         } catch (e) {
           console.error("Time sync failed", e);
         }
      }
    }
  };

  const handleToggleGradeRestriction = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user && isSuperAdmin) {
      const updated = { ...user, forceSingleGrade: !user.forceSingleGrade };
      db.updateUser(updated);
      refresh();
      
      if (db.getGoogleConfig()?.scriptUrl) {
        try {
          await db.syncUserToGoogle(updated);
        } catch (e) {
          console.error("Grade Restriction sync failed", e);
        }
      }
    }
  };

  const handleBulkTimeUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkStartTime || !bulkEndTime) {
      setError("Vui lòng chọn đầy đủ thời gian bắt đầu và kết thúc.");
      return;
    }
    
    if (!isSuperAdmin) return;
    
    if (selectedUserIds.size === 0) {
        setError("Vui lòng chọn ít nhất 1 giáo viên để cập nhật.");
        return;
    }
    
    if (!window.confirm(`Bạn có chắc chắn muốn cập nhật thời gian cho ${selectedUserIds.size} giáo viên đã chọn?`)) {
      return;
    }

    setIsBulkUpdating(true);
    setError('');
    setSuccess('');
    setBulkProgress(0);

    // Filter only selected users
    const usersToUpdate = users.filter(u => selectedUserIds.has(u.id));
    let successCount = 0;
    
    try {
        for (let i = 0; i < usersToUpdate.length; i++) {
            const teacher = usersToUpdate[i];
            const updated = {
                ...teacher,
                drawStartTime: bulkStartTime,
                drawEndTime: bulkEndTime
            };
            
            // Update Local
            db.updateUser(updated);
            
            // Sync to Google (Sequential to avoid rate limit)
            try {
                await db.syncUserToGoogle(updated);
            } catch (err) {
                console.error(`Failed to sync for ${teacher.email}`);
            }
            
            successCount++;
            setBulkProgress(Math.round(((i + 1) / usersToUpdate.length) * 100));
        }
        
        refresh();
        setSuccess(`Đã cập nhật thời gian cho ${successCount} giáo viên thành công!`);
        setIsBulkTimeModalOpen(false);
        setSelectedUserIds(new Set()); // Clear selection after success
    } catch (err: any) {
        setError("Có lỗi xảy ra trong quá trình cập nhật hàng loạt.");
    } finally {
        setIsBulkUpdating(false);
    }
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    if (!isSuperAdmin) {
      setError("Chỉ Admin tối cao mới có quyền xóa tài khoản.");
      return;
    }
    if (window.confirm(`Bạn có chắc chắn muốn xóa giáo viên "${userName}" không? Hành động này không thể hoàn tác.`)) {
      try {
        db.deleteUser(userId);
        refresh();
        setSuccess(`Đã xóa giáo viên ${userName} thành công.`);
        // Remove from selection if deleted
        if (selectedUserIds.has(userId)) {
            const newSet = new Set(selectedUserIds);
            newSet.delete(userId);
            setSelectedUserIds(newSet);
        }
      } catch (e: any) {
        setError(e.message || "Không thể xóa giáo viên.");
      }
    }
  };

  const handleResetDraw = async (userId: string, userName: string) => {
    if (!isSuperAdmin) {
      setError("Bạn không có quyền này.");
      return;
    }
    if (window.confirm(`Bạn có chắc chắn muốn XÓA KẾT QUẢ bốc thăm của "${userName}" để họ bốc lại không?`)) {
        try {
            await db.resetDraw(userId);
            refresh();
            setSuccess(`Đã xóa kết quả của ${userName}, giáo viên có thể bốc lại ngay.`);
        } catch(e: any) {
            setError(e.message || "Lỗi khi reset bốc thăm.");
        }
    }
  };

  const handleRoleChange = async (userId: string, newRole: Role) => {
     const user = users.find(u => u.id === userId);
     if (!user || !isSuperAdmin) return;
     if (user.role === newRole) return;

     const roleNames = {
        [Role.ADMIN]: 'QUẢN TRỊ VIÊN (Admin)',
        [Role.MANAGER]: 'QUẢN LÝ (Manager)',
        [Role.TEACHER]: 'GIÁO VIÊN'
     };
     
     if (window.confirm(`Bạn muốn đổi quyền của "${user.name}" sang ${roleNames[newRole]}?`)) {
       try {
         const updated = { ...user, role: newRole };
         db.updateUser(updated);
         refresh();
         
         if (db.getGoogleConfig()?.scriptUrl) {
            setSuccess("Đang đồng bộ quyền lên Google Sheet...");
            await db.syncUserToGoogle(updated);
            setSuccess(`Đã cập nhật và đồng bộ quyền cho ${user.name}.`);
         }
       } catch (e: any) {
         setError("Đã lưu máy nhưng lỗi đồng bộ: " + e.message);
       }
     } else {
         refresh();
     }
  };

  const handleSyncGoogle = async () => {
    if (!isSuperAdmin) {
      setError("Bạn không có quyền đồng bộ.");
      return;
    }
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const result = await db.syncFromGoogle({ scriptUrl: '' });
      setSuccess(`Đồng bộ thành công! Đã tải ${result.userCount} giáo viên, ${result.lessonCount} bài học và ${result.classCount || 0} lớp.`);
      refresh();
      // Reset selection after sync as list might change
      setSelectedUserIds(new Set());
    } catch (err: any) {
      setError(err.message || "Lỗi khi kết nối Google Sheet.");
    } finally {
      setIsLoading(false);
    }
  };

  // ... (Excel Import Logic - unchanged) ...
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      // ... (Same as previous code) ...
      // Keeping logic concise for XML update, assume existing Excel logic is preserved
      if (!isSuperAdmin) {
       setError("Bạn không có quyền nhập file.");
       return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      let importedLessonsCount = 0;
      let importedUsersCount = 0;

      const lessonSheetName = workbook.SheetNames.find(n => n.toLowerCase() === 'lessons' || n.toLowerCase().includes('bài'));
      if (lessonSheetName) {
        const ws = workbook.Sheets[lessonSheetName];
        const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (jsonData.length > 0) jsonData.shift();
        const newLessons: Lesson[] = jsonData
          .filter(row => row && row.length >= 5 && row[0])
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

      const userSheetName = workbook.SheetNames.find(n => n.toLowerCase() === 'users' || n.toLowerCase().includes('giáo'));
      if (userSheetName) {
         const ws = workbook.Sheets[userSheetName];
         const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
         if (jsonData.length > 0) jsonData.shift();

         const newUsers: User[] = [];
         jsonData.forEach((row, index) => {
            if (!row || row.length < 2 || !row[1]) return; 
            const parseExcelDate = (val: any, defaultDate: Date): string => {
                if (!val) {
                    const d = defaultDate;
                    const pad = (n: number) => n.toString().padStart(2, '0');
                    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                }
                const d = new Date(val);
                if (!isNaN(d.getTime())) {
                    const pad = (n: number) => n.toString().padStart(2, '0');
                    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                }
                const def = defaultDate;
                const pad = (n: number) => n.toString().padStart(2, '0');
                return `${def.getFullYear()}-${pad(def.getMonth() + 1)}-${pad(def.getDate())}T${pad(def.getHours())}:${pad(def.getMinutes())}`;
            };
            const roleStr = String(row[3] || '').trim().toUpperCase();
            let finalRole = Role.TEACHER;
            if (roleStr === 'ADMIN') finalRole = Role.ADMIN;
            else if (roleStr === 'MANAGER') finalRole = Role.MANAGER;

            newUsers.push({
              id: `imported-excel-user-${Date.now()}-${index}`,
              name: String(row[0]),
              email: String(row[1]),
              password: String(row[2] || '123'),
              role: finalRole,
              subjectGroup: String(row[4] || ''),
              drawStartTime: parseExcelDate(row[5], new Date()),
              drawEndTime: parseExcelDate(row[6], new Date(Date.now() + 86400000)),
              hasDrawn: false,
              drawnClass: '',
              forceSingleGrade: false
            });
         });
         if (!newUsers.some(u => u.role === Role.ADMIN)) {
            const currentAdmin = users.find(u => u.role === Role.ADMIN);
            if (currentAdmin) newUsers.unshift(currentAdmin);
            else {
                 const d = new Date();
                 const pad = (n: number) => n.toString().padStart(2, '0');
                 const localNow = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                 newUsers.unshift({
                    id: 'admin-fallback',
                    email: 'admin@edu.vn',
                    password: 'admin',
                    name: 'Quản Trị Viên',
                    role: Role.ADMIN,
                    drawStartTime: localNow,
                    drawEndTime: localNow,
                    hasDrawn: false,
                    forceSingleGrade: false
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
        "Bắt đầu bốc thăm": u.drawStartTime.replace('T', ' '),
        "Kết thúc bốc thăm": u.drawEndTime.replace('T', ' '),
        "Trạng thái": u.hasDrawn ? "Đã bốc" : "Chưa bốc",
        "Tên Bài Dạy": l ? l.name : '',
        "Khối": l ? l.grade : '',
        "Lớp dạy": u.drawnClass || '',
        "Tuần": l ? l.week : '',
        "Tiết": l ? l.period : ''
      };
    });
  };

  const handleExportExcel = () => {
    const exportData = createExcelData(users.filter(u => u.role !== Role.ADMIN));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const wscols = [{wch: 20}, {wch: 25}, {wch: 15}, {wch: 20}, {wch: 20}, {wch: 10}, {wch: 40}, {wch: 10}, {wch: 10}, {wch: 8}, {wch: 8}];
    worksheet['!cols'] = wscols;
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kết Quả Bốc Thăm");
    XLSX.writeFile(workbook, "ket_qua_boc_tham_tong_hop.xlsx");
  };
  
  const handleExportSingleUser = (user: User) => {
    const exportData = createExcelData([user]);
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const wscols = [{wch: 20}, {wch: 25}, {wch: 15}, {wch: 20}, {wch: 20}, {wch: 10}, {wch: 40}, {wch: 10}, {wch: 10}, {wch: 8}, {wch: 8}];
    worksheet['!cols'] = wscols;
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kết Quả Chi Tiết");
    const safeName = user.name.replace(/[^a-z0-9\u00C0-\u1EF9]/gi, '_').toLowerCase();
    XLSX.writeFile(workbook, `ket_qua_${safeName}.xlsx`);
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
        hasDrawn: false,
        forceSingleGrade: false
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
      if (newSettings.classes) {
          newSettings.classes = newSettings.classes.filter(c => c.grade !== value);
      }
    }
    db.saveSettings(newSettings);
    refresh();
  };
  
  const handleAddClass = () => {
     if (!selectedGradeForClass || !newClassName.trim()) return;
     const newSettings = { ...settings };
     if (!newSettings.classes) newSettings.classes = [];
     const exists = newSettings.classes.some(c => c.grade === selectedGradeForClass && c.name === newClassName.trim());
     if (!exists) {
         newSettings.classes.push({
             id: `c-${Date.now()}`,
             grade: selectedGradeForClass,
             name: newClassName.trim()
         });
         db.saveSettings(newSettings);
         setNewClassName('');
         refresh();
     }
  };
  
  const handleRemoveClass = (classId: string) => {
      const newSettings = { ...settings };
      newSettings.classes = newSettings.classes.filter(c => c.id !== classId);
      db.saveSettings(newSettings);
      refresh();
  };

  const handleKeyDown = (e: React.KeyboardEvent, type: 'subject' | 'grade' | 'class') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (type === 'class') handleAddClass();
      else handleAddConfig(type);
    }
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

      {error && (
        <div className="border border-red-200 bg-red-100 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2 animate-fade-in">
           <AlertTriangle className="w-5 h-5" />
           {error}
           <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <header className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Quản Trị Hệ Thống</h1>
          <p className="text-slate-500">
            {isSuperAdmin ? "Quản lý toàn bộ hệ thống" : "Quản lý giáo viên và thời gian"}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => isSuperAdmin && handleSyncGoogle()}
            disabled={!isSuperAdmin || isLoading}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-sm font-medium transition-colors
              ${isSuperAdmin 
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
            `}
            title={!isSuperAdmin ? "Bạn không có quyền đồng bộ dữ liệu" : ""}
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            {isLoading ? "Đang đồng bộ..." : "Đồng bộ Sheet"}
          </button>
          
          <button 
            onClick={() => isSuperAdmin && fileInputRef.current?.click()}
            disabled={!isSuperAdmin}
            className={`
              flex items-center gap-2 border px-4 py-2.5 rounded-lg shadow-sm font-medium transition-colors
              ${isSuperAdmin
                ? 'bg-white border-slate-300 hover:bg-slate-50 text-slate-700'
                : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'}
            `}
          >
            {isSuperAdmin ? <Upload className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
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
            Cấu hình chung (Môn/Khối/Lớp)
          </button>
        </nav>
      </div>

      {activeTab === 'users' ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* BULK ACTIONS TOOLBAR */}
          {isSuperAdmin && (
             <div className="p-4 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                <div className="flex items-center gap-3 text-blue-800 font-medium text-sm">
                   <Zap className="w-4 h-4" />
                   <span>Đã chọn: <strong>{selectedUserIds.size}</strong> giáo viên</span>
                </div>
                <button 
                   onClick={() => setIsBulkTimeModalOpen(true)}
                   disabled={selectedUserIds.size === 0}
                   className={`
                     flex items-center gap-2 px-3 py-1.5 border rounded-md shadow-sm text-xs font-bold transition-colors
                     ${selectedUserIds.size > 0 
                        ? 'bg-white border-blue-200 text-blue-700 hover:bg-blue-100 cursor-pointer' 
                        : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'}
                   `}
                >
                   <Clock className="w-3.5 h-3.5" />
                   Cập nhật giờ cho {selectedUserIds.size} người
                </button>
             </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 uppercase font-medium">
                <tr>
                  <th className="px-4 py-4 w-10 text-center">
                    <button onClick={handleSelectAll} className="text-slate-500 hover:text-blue-600">
                        {selectedUserIds.size > 0 && selectedUserIds.size === teachers.length ? (
                            <CheckSquare className="w-5 h-5" />
                        ) : (
                            <Square className="w-5 h-5" />
                        )}
                    </button>
                  </th>
                  <th className="px-6 py-4">Giáo viên</th>
                  <th className="px-6 py-4">Quyền hạn</th>
                  <th className="px-6 py-4">Môn dạy</th>
                  <th className="px-6 py-4">Khung giờ bốc thăm</th>
                  <th className="px-6 py-4 text-center">Số khối</th>
                  <th className="px-6 py-4">Trạng thái</th>
                  <th className="px-6 py-4 w-24">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.filter(u => u.role !== Role.ADMIN).map((user) => {
                  const isSelected = selectedUserIds.has(user.id);
                  return (
                  <tr key={user.id} className={`transition-colors ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}>
                    <td className="px-4 py-4 text-center">
                        <button onClick={() => handleSelectUser(user.id)} className={`${isSelected ? 'text-blue-600' : 'text-slate-300 hover:text-slate-500'}`}>
                            {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                        </button>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      <div>{user.name}</div>
                      <div className="text-xs text-slate-400 font-normal">{user.email}</div>
                    </td>
                     <td className="px-6 py-4">
                      {isSuperAdmin ? (
                        <div className="relative inline-block">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                            className={`
                              appearance-none pl-8 pr-8 py-1.5 rounded-lg text-xs font-bold border outline-none cursor-pointer transition-all
                              ${user.role === Role.ADMIN ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' : ''}
                              ${user.role === Role.MANAGER ? 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100' : ''}
                              ${user.role === Role.TEACHER ? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100' : ''}
                            `}
                          >
                            <option value={Role.TEACHER}>Giáo viên</option>
                            <option value={Role.MANAGER}>Quản lý</option>
                            <option value={Role.ADMIN}>Admin</option>
                          </select>
                          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                            {user.role === Role.ADMIN && <Shield className="w-3.5 h-3.5 text-red-600" />}
                            {user.role === Role.MANAGER && <Shield className="w-3.5 h-3.5 text-orange-600" />}
                            {user.role === Role.TEACHER && <UserIcon className="w-3.5 h-3.5 text-slate-500" />}
                          </div>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                        </div>
                      ) : (
                         <span className={`text-xs ${user.role === Role.MANAGER ? 'text-orange-600 font-bold' : 'text-slate-500'}`}>
                           {user.role === Role.MANAGER ? 'Quản lý' : 'Giáo viên'}
                         </span>
                      )}
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
                    <td className="px-6 py-4 text-center">
                        <button
                           onClick={() => handleToggleGradeRestriction(user.id)}
                           disabled={!isSuperAdmin}
                           className={`
                              flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all mx-auto
                              ${user.forceSingleGrade 
                                ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' 
                                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}
                              ${!isSuperAdmin ? 'cursor-not-allowed opacity-70' : ''}
                           `}
                           title={user.forceSingleGrade ? "Đang quy định: Chỉ được chọn 1 khối" : "Mặc định: Được chọn 1-2 khối"}
                        >
                           {user.forceSingleGrade ? (
                               <>
                                 <ToggleRight className="w-4 h-4" />
                                 <span>1 Khối</span>
                               </>
                           ) : (
                               <>
                                 <ToggleLeft className="w-4 h-4" />
                                 <span>Tùy chọn</span>
                               </>
                           )}
                        </button>
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
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        {user.hasDrawn && isSuperAdmin && (
                          <button
                            onClick={() => handleResetDraw(user.id, user.name)}
                            className="text-slate-400 hover:text-orange-600 transition-colors p-2 rounded-full hover:bg-orange-50"
                            title="Xóa kết quả để bốc lại"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleExportSingleUser(user)}
                          className="text-slate-400 hover:text-green-600 transition-colors p-2 rounded-full hover:bg-green-50"
                          title="Xuất kết quả cá nhân (Excel)"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                        </button>
                        {isSuperAdmin && (
                          <button
                            onClick={() => handleDeleteUser(user.id, user.name)}
                            className="text-slate-400 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-red-50"
                            title="Xóa giáo viên"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )})}
                {users.filter(u => u.role !== 'ADMIN').length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400">Chưa có dữ liệu giáo viên.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
         // ... (CONFIG UI UNCHANGED - Kept simple for XML) ...
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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

          {/* Classes Config */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
              <Home className="w-5 h-5 text-green-500" />
              Quản lý Lớp học
            </h3>
            
            <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Chọn khối lớp</label>
                <select 
                    value={selectedGradeForClass} 
                    onChange={(e) => setSelectedGradeForClass(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                >
                    <option value="">-- Chọn khối --</option>
                    {settings.grades.map(g => (
                        <option key={g} value={g}>{g}</option>
                    ))}
                </select>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder={selectedGradeForClass ? "Nhập tên lớp (VD: 6A1)..." : "Vui lòng chọn khối trước"}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'class')}
                disabled={!selectedGradeForClass}
              />
              <button
                onClick={handleAddClass}
                disabled={!selectedGradeForClass}
                className={`
                    px-4 py-2 rounded-lg text-sm font-medium transition-colors
                    ${!selectedGradeForClass ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}
                `}
              >
                Thêm
              </button>
            </div>

            <ul className="space-y-2 max-h-80 overflow-y-auto">
              {selectedGradeForClass ? (
                 (settings.classes || []).filter(c => c.grade === selectedGradeForClass).map((c, idx) => (
                    <li key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100 group hover:border-green-100 hover:bg-green-50/30 transition-colors">
                      <span className="text-slate-700 font-medium">{c.name}</span>
                      <button
                        onClick={() => handleRemoveClass(c.id)}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50"
                        title="Xóa lớp"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                 ))
              ) : (
                <li className="text-center text-slate-400 py-4 text-sm">Chọn khối để xem danh sách lớp.</li>
              )}
              {selectedGradeForClass && (settings.classes || []).filter(c => c.grade === selectedGradeForClass).length === 0 && (
                <li className="text-center text-slate-400 py-4 text-sm">Khối này chưa có lớp nào.</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Bulk Time Modal */}
      {isBulkTimeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
             <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-blue-50">
               <div className="flex items-center gap-2">
                   <Clock className="w-5 h-5 text-blue-600" />
                   <h3 className="font-bold text-lg text-slate-800">Cập nhật Giờ Hàng Loạt</h3>
               </div>
               <button onClick={() => !isBulkUpdating && setIsBulkTimeModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
             </div>
             
             <div className="p-6">
                <p className="text-sm text-slate-600 mb-4 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                   <AlertTriangle className="w-4 h-4 inline-block mr-1 text-yellow-600" />
                   Bạn đang chuẩn bị cập nhật thời gian cho <strong>{selectedUserIds.size} giáo viên</strong> đã chọn.
                </p>

                <form onSubmit={handleBulkTimeUpdate} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Thời gian bắt đầu chung</label>
                      <input type="datetime-local" required className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={bulkStartTime} onChange={(e) => setBulkStartTime(e.target.value)} disabled={isBulkUpdating} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Thời gian kết thúc chung</label>
                      <input type="datetime-local" required className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={bulkEndTime} onChange={(e) => setBulkEndTime(e.target.value)} disabled={isBulkUpdating} />
                    </div>

                    {isBulkUpdating && (
                        <div className="pt-2">
                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                                <span>Đang xử lý {Math.round((bulkProgress / 100) * selectedUserIds.size)} / {selectedUserIds.size}...</span>
                                <span>{bulkProgress}%</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2">
                                <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${bulkProgress}%` }}></div>
                            </div>
                        </div>
                    )}

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={() => setIsBulkTimeModalOpen(false)} disabled={isBulkUpdating} className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">Hủy bỏ</button>
                        <button type="submit" disabled={isBulkUpdating} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg flex justify-center items-center gap-2">
                           {isBulkUpdating ? "Đang đồng bộ..." : "Cập nhật ngay"}
                        </button>
                    </div>
                </form>
             </div>
          </div>
        </div>
      )}

      {/* Add Teacher Modal (Unchanged) */}
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
