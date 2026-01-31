import React, { useState, useEffect } from 'react';
import { User, Role } from './types';
import { db } from './services/db';
import { AdminPanel } from './components/AdminPanel';
import { TeacherPanel } from './components/TeacherPanel';
import { LogOut, GraduationCap, Settings, RefreshCw, Cloud, X, Check, Database, AlertCircle } from 'lucide-react';
import.meta.env.VITE_SCRIPT_URL;
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  // Data Sync State
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [configUrl, setConfigUrl] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{success: boolean, msg: string} | null>(null);

  useEffect(() => {
    // Initialize DB (mock data)
    db.init();
    const currentUser = db.getCurrentUser();
    if (currentUser) setUser(currentUser);

    // Auto-sync if config exists
    const config = db.getGoogleConfig();
    if (config?.scriptUrl) {
      handleAutoSync(config.scriptUrl);
    }
  }, []);

  useEffect(() => {
    if (isConfigOpen) {
      const config = db.getGoogleConfig();
      if (config) setConfigUrl(config.scriptUrl);
      setSyncResult(null);
    }
  }, [isConfigOpen]);

  const handleAutoSync = async (url: string) => {
    setIsSyncing(true);
    try {
      await db.syncFromGoogle({ scriptUrl: url });
      console.log("Auto-sync successful");
      
      // REFRESH STATE: Update user UI if data changed in background sync
      const currentUser = db.getCurrentUser();
      // We check if the current logged-in user (in state) matches the one in DB (by email)
      // to ensure we update their permissions/times immediately.
      if (currentUser && user && currentUser.email === user.email) {
         setUser(currentUser);
      }
    } catch (e) {
      console.error("Auto-sync failed", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configUrl) return;
    
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await db.syncFromGoogle({ scriptUrl: configUrl });
      setSyncResult({
        success: true, 
        msg: `Kết nối thành công! Đã cập nhật ${res.userCount} giáo viên.`
      });
      // Save valid config
      db.saveGoogleConfig({ scriptUrl: configUrl });
      
      // Update current user state if logged in
      const currentUser = db.getCurrentUser();
      if (currentUser && user && currentUser.email === user.email) {
         setUser(currentUser);
      }
    } catch (err: any) {
      setSyncResult({
        success: false,
        msg: err.message || "Lỗi kết nối. Vui lòng kiểm tra lại URL."
      });
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

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 relative">
        
        {/* Settings Button */}
        <button 
          onClick={() => setIsConfigOpen(true)}
          className="absolute top-4 right-4 flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur text-slate-600 rounded-full shadow-sm hover:bg-white transition-all text-sm font-medium"
        >
          {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin text-blue-600" /> : <Database className="w-4 h-4" />}
          <span>Kết nối dữ liệu</span>
        </button>

        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 relative">
          <div className="text-center mb-8">
            {/* Logo Section */}
            <div className="flex flex-col items-center justify-center mb-6">
              <div className="w-28 h-28 mb-3 relative flex items-center justify-center">
                 {/* Image Logo - Defaulting to ./logo.png. 
                     Use onError to fallback if image is missing 
                 */}
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
              
              <h2 className="text-xl font-bold text-blue-900 uppercase tracking-wide leading-tight">
                Trường THCS<br/>Lý Thường Kiệt
              </h2>
              <div className="w-16 h-1 bg-blue-500 rounded-full my-3"></div>
              <p className="text-slate-500 font-medium">Hội Thi Giáo Viên Dạy Giỏi</p>
            </div>
            
            <h1 className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Cổng Đăng Nhập</h1>
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

        {/* Config Modal */}
        {isConfigOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-600" />
                  Kết nối Google Sheet
                </h3>
                <button onClick={() => setIsConfigOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              
              <form onSubmit={handleManualSync} className="p-6 space-y-4">
                <div className="text-sm text-slate-600 mb-4 bg-blue-50 p-4 rounded-lg">
                   Nhập đường dẫn <strong>Google Apps Script Web App</strong> để đồng bộ danh sách giáo viên và ngân hàng đề thi về thiết bị này.
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Web App URL</label>
                  <div className="relative">
                    <Cloud className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                    <input 
                      type="url"
                      required
                      placeholder="https://script.google.com/macros/s/..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-xs"
                      value={configUrl}
                      onChange={(e) => setConfigUrl(e.target.value)}
                    />
                  </div>
                </div>

                {syncResult && (
                  <div className={`p-3 rounded-lg text-sm flex items-start gap-2 ${syncResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {syncResult.success ? <Check className="w-4 h-4 mt-0.5" /> : <X className="w-4 h-4 mt-0.5" />}
                    {syncResult.msg}
                  </div>
                )}

                <div className="pt-2 flex gap-3">
                  <button type="button" onClick={() => setIsConfigOpen(false)} className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-medium">Đóng</button>
                  <button type="submit" disabled={isSyncing} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg flex justify-center items-center gap-2 font-medium">
                    {isSyncing ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> Đang đồng bộ...</>
                    ) : (
                      "Lưu & Đồng bộ"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
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
                 <span className="font-bold text-sm text-blue-900 uppercase leading-none">THCS Lý Thường Kiệt</span>
                 <span className="text-xs text-slate-500">Hội Thi GVDG</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-slate-800">{user.name}</p>
                <p className="text-xs text-slate-500">{user.role === Role.ADMIN ? 'Quản trị viên' : 'Giáo viên'}</p>
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
        {user.role === Role.ADMIN ? (
          <AdminPanel />
        ) : (
          <TeacherPanel user={user} onUpdateUser={setUser} />
        )}
      </main>
      
      <footer className="bg-white border-t border-slate-200 py-6 mt-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-slate-500 text-sm font-medium">
          Copyright Huỳnh Bá Sơn
        </div>
      </footer>
    </div>
  );
}
