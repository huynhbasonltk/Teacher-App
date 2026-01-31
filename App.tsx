import React, { useState, useEffect } from 'react';
import { User, Role } from './types';
import { db } from './services/db';
import { AdminPanel } from './components/AdminPanel';
import { TeacherPanel } from './components/TeacherPanel';
import { LogOut, GraduationCap, RefreshCw, Database, AlertCircle, Check, X } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  // Data Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    // Initialize DB
    db.init();
    const currentUser = db.getCurrentUser();
    if (currentUser) setUser(currentUser);

    // Auto-sync on load using the hardcoded URL in db.ts
    handleAutoSync();
  }, []);

  const handleAutoSync = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      // Logic handles the hardcoded URL internally
      const res = await db.syncFromGoogle({ scriptUrl: '' }); 
      console.log("Auto-sync successful");
      
      setSyncMessage({ type: 'success', text: `Đã cập nhật dữ liệu: ${res.userCount} GV.` });

      // Clear message after 3 seconds
      setTimeout(() => setSyncMessage(null), 3000);
      
      // REFRESH STATE: Update user UI if data changed in background sync
      const currentUser = db.getCurrentUser();
      if (currentUser && user && currentUser.email === user.email) {
         setUser(currentUser);
      }
    } catch (e: any) {
      console.error("Auto-sync failed", e);
      // Optional: Don't show error on auto-sync to avoid annoyance, 
      // or show it if triggered manually via the button.
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualSyncClick = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const res = await db.syncFromGoogle({ scriptUrl: '' });
      setSyncMessage({ type: 'success', text: `Thành công! Cập nhật ${res.userCount} GV.` });
      
      const currentUser = db.getCurrentUser();
      if (currentUser && user && currentUser.email === user.email) {
         setUser(currentUser);
      }
    } catch (e: any) {
      setSyncMessage({ type: 'error', text: e.message || "Lỗi kết nối Server." });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const loggedUser = db.login(email, password);
    if (loggedUser) {
      setUser(loggedUser);
      setError('');
    } else {
      setError('Email hoặc mật khẩu không đúng.');
    }
  };

  const handleLogout = () => {
    db.logout();
    setUser(null);
    setEmail('');
    setPassword('');
  };

  // Determine if user has admin access (ADMIN or MANAGER)
  const isAdminAccess = user && (user.role === Role.ADMIN || user.role === Role.MANAGER);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 relative">
        
        {/* Sync Status Toast */}
        {syncMessage && (
          <div className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium animate-fade-in ${
            syncMessage.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
             {syncMessage.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
             {syncMessage.text}
          </div>
        )}

        {/* Sync Button - Responsive for Mobile */}
        <button 
          onClick={handleManualSyncClick}
          disabled={isSyncing}
          className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-white/90 backdrop-blur text-slate-600 rounded-full shadow-md hover:bg-blue-50 hover:text-blue-600 transition-all text-sm font-medium disabled:opacity-70 disabled:cursor-not-allowed"
          title="Làm mới dữ liệu từ Server"
        >
          {isSyncing ? <RefreshCw className="w-5 h-5 animate-spin text-blue-600" /> : <Database className="w-5 h-5" />}
          <span className="hidden sm:inline">{isSyncing ? "Đang tải..." : "Cập nhật dữ liệu"}</span>
        </button>

        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 relative">
          <div className="text-center mb-8">
            {/* Logo Section */}
            <div className="flex flex-col items-center justify-center mb-6">
              <div className="w-24 h-24 sm:w-28 sm:h-28 mb-3 relative flex items-center justify-center">
                 <img 
                   src="./logo.png" 
                   onError={(e) => {
                     e.currentTarget.style.display = 'none';
                     e.currentTarget.nextElementSibling?.classList.remove('hidden');
                   }}
                   alt="Logo Trường" 
                   className="w-full h-full object-contain drop-shadow-sm"
                 />
                 
                 {/* Fallback Icon */}
                 <div className="hidden w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center relative">
                    <GraduationCap className="w-12 h-12 text-blue-600" />
                    {isSyncing && (
                      <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500 border-2 border-white"></span>
                      </span>
                    )}
                 </div>
              </div>
              
              <h2 className="text-lg sm:text-xl font-bold text-blue-900 uppercase tracking-wide leading-tight">
                Trường THCS<br/>Lý Thường Kiệt
              </h2>
              <div className="w-16 h-1 bg-blue-500 rounded-full my-3"></div>
              <p className="text-slate-500 font-medium text-sm sm:text-base">Hội Thi Giáo Viên Dạy Giỏi</p>
            </div>
            
            <h1 className="text-xs sm:text-sm font-semibold text-slate-400 uppercase tracking-widest">Cổng Đăng Nhập</h1>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="ten.gv@truong.edu.vn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu</label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg border border-red-100 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-3 rounded-lg transition-colors shadow-lg shadow-blue-500/30 uppercase tracking-wide text-sm"
            >
              Đăng Nhập
            </button>
            
            <div className="mt-4 p-4 bg-slate-50 rounded text-xs text-slate-500 text-center">
              Nếu bạn không đăng nhập được, vui lòng liên hệ quản trị viên nhà trường.
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
                <img src="./logo.png" alt="Logo" className="w-full h-full object-contain" onError={(e) => e.currentTarget.style.display='none'} />
                <GraduationCap className="text-blue-600 w-6 h-6 hidden" /> 
              </div>
              <div className="flex flex-col">
                 <span className="font-bold text-xs sm:text-sm text-blue-900 uppercase leading-none">THCS Lý Thường Kiệt</span>
                 <span className="text-[10px] sm:text-xs text-slate-500">Hội Thi GVDG</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-800 max-w-[120px] sm:max-w-none truncate">{user.name}</p>
                <div className="flex items-center justify-end gap-1 text-xs text-slate-500">
                  {user.role === Role.ADMIN && <span className="text-red-600 font-bold">Admin</span>}
                  {user.role === Role.MANAGER && <span className="text-orange-600 font-bold">Quản lý</span>}
                  {user.role === Role.TEACHER && <span className="hidden sm:inline">Giáo viên</span>}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                title="Đăng xuất"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow">
        {isAdminAccess ? (
          <AdminPanel currentUser={user} />
        ) : (
          <TeacherPanel user={user} onUpdateUser={setUser} />
        )}
      </main>
      
      <footer className="bg-white border-t border-slate-200 py-6 mt-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-slate-500 text-sm font-medium">
          Copyright@Huỳnh Bá Sơn
        </div>
      </footer>
    </div>
  );
}
