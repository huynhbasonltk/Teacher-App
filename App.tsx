import React, { useState, useEffect } from 'react';
import { User, Role } from './types';
import { db } from './services/db';
import { AdminPanel } from './components/AdminPanel';
import { TeacherPanel } from './components/TeacherPanel';
import { LogOut, GraduationCap, Settings, RefreshCw, Cloud, X, Check, Database, AlertCircle } from 'lucide-react';

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
      // We don't show a loud success message for auto-sync, just console
      console.log("Auto-sync successful");
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
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4 relative">
              <GraduationCap className="w-8 h-8 text-blue-600" />
              {isSyncing && (
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500 border-2 border-white"></span>
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Cổng Đăng Nhập</h1>
            <p className="text-slate-500 mt-2">Hội Thi Giáo Viên Dạy Giỏi</p>
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
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors shadow-lg shadow-blue-500/30"
            >
              Đăng Nhập
            </button>
            
            <div className="mt-4 p-4 bg-slate-50 rounded text-xs text-slate-500">
              <p className="font-bold mb-1">Hướng dẫn:</p>
              <p>Nếu bạn không đăng nhập được, vui lòng nhấn vào nút <strong>"Kết nối dữ liệu"</strong> ở góc phải màn hình để cập nhật danh sách giáo viên mới nhất từ hệ thống.</p>
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
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <GraduationCap className="text-white w-5 h-5" />
              </div>
              <span className="font-bold text-xl text-slate-800 tracking-tight hidden sm:block">Hội Thi GVDG</span>
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
        <div className="max-w-7xl mx-auto px-6 text-center text-slate-400 text-sm">
          &copy; {new Date().getFullYear()} Hệ thống quản lý hội thi. Được thiết kế cho mục đích demo.
        </div>
      </footer>
    </div>
  );
}
