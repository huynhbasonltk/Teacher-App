
import React, { useState, useEffect } from 'react';
import { User, Lesson } from '../types';
import { db } from '../services/db';
import { Clock, BookOpen, Check, AlertCircle, Sparkles, XCircle, CalendarDays } from 'lucide-react';

interface Props {
  user: User;
  onUpdateUser: (u: User) => void;
}

export const TeacherPanel: React.FC<Props> = ({ user, onUpdateUser }) => {
  const [now, setNow] = useState(new Date());
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Lesson | null>(null);
  const [availableGrades, setAvailableGrades] = useState<string[]>([]);

  const startTime = new Date(user.drawStartTime);
  const endTime = new Date(user.drawEndTime);
  
  const isTooEarly = now < startTime;
  const isTooLate = now > endTime;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const canEnter = !isTooEarly && !isTooLate;
  
  // Check if user subject requires 2 grades
  const specialSubjects = ["Tin Học", "Tin học", "GDCD", "Mĩ thuật", "Âm nhạc"];
  const userSubject = user.subjectGroup?.trim() || "";
  const isSpecialSubject = specialSubjects.some(s => s.toLowerCase() === userSubject.toLowerCase());
  
  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Load dynamic grades
    const settings = db.getSettings();
    if (settings && settings.grades) {
      setAvailableGrades(settings.grades);
    }
  }, []);

  // Load existing result if already drawn
  useEffect(() => {
    if (user.hasDrawn && user.drawnLessonId) {
      const l = db.getLessonById(user.drawnLessonId);
      if (l) setResult(l);
    }
  }, [user]);

  const toggleGrade = (grade: string) => {
    if (selectedGrades.includes(grade)) {
      setSelectedGrades(prev => prev.filter(g => g !== grade));
      // Clear error if related to selection limit
      if (error && error.includes("tối đa")) setError(null);
    } else {
      if (selectedGrades.length >= 2) {
        setError("Quý thầy/cô chỉ được chọn tối đa 2 khối lớp.");
        return;
      }
      setSelectedGrades(prev => [...prev, grade]);
      setError(null);
    }
  };

  const handleDraw = async () => {
    if (selectedGrades.length === 0) {
      setError("Vui lòng chọn ít nhất 1 khối lớp để bốc thăm.");
      return;
    }

    // Validation for special subjects
    if (isSpecialSubject && selectedGrades.length < 2) {
      setError(`Đối với môn ${userSubject}, quy định bắt buộc phải chọn đủ 2 khối lớp.`);
      return;
    }

    setError(null);
    setIsDrawing(true);

    try {
      // Small artificial delay for effect, but now primarily waiting for network
      const resultPromise = db.drawLesson(user.id, selectedGrades);
      const minDelay = new Promise(resolve => setTimeout(resolve, 2000));
      
      const [data] = await Promise.all([resultPromise, minDelay]);

      if (data && data.lesson) {
        setResult(data.lesson);
        // Update parent state
        const updatedUser = db.getCurrentUser();
        if (updatedUser) onUpdateUser(updatedUser);
      } else {
        setError("Hiện tại đã hết tiết dạy phù hợp trong các khối đã chọn. Vui lòng chọn khối lớp khác.");
      }
    } catch (e: any) {
      setError(e.message || "Có lỗi xảy ra.");
    } finally {
      setIsDrawing(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleString('vi-VN', { 
      year: 'numeric', 
      month: 'numeric', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isTooEarly) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-amber-50 text-amber-800 p-8 rounded-2xl shadow-sm border border-amber-100 max-w-lg w-full">
          <Clock className="w-16 h-16 mx-auto mb-4 text-amber-500" />
          <h2 className="text-2xl font-bold mb-2">Chưa đến giờ bốc thăm</h2>
          <p className="text-lg mb-6">Xin chào cô/thầy <strong>{user.name}</strong>.</p>
          <div className="bg-white/50 p-4 rounded-lg space-y-2">
             <div className="flex justify-between items-center text-sm border-b border-amber-100 pb-2">
                <span className="text-amber-900/60">Bắt đầu:</span>
                <span className="font-mono font-semibold text-amber-700">{formatDate(startTime)}</span>
             </div>
             <div className="flex justify-between items-center text-sm pt-1">
                <span className="text-amber-900/60">Kết thúc:</span>
                <span className="font-mono font-semibold text-amber-700">{formatDate(endTime)}</span>
             </div>
          </div>
          <p className="mt-6 text-sm text-amber-900/60">Vui lòng quay lại sau.</p>
        </div>
      </div>
    );
  }

  if (isTooLate && !user.hasDrawn) {
     return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-red-50 text-red-800 p-8 rounded-2xl shadow-sm border border-red-100 max-w-lg w-full">
          <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-2xl font-bold mb-2">Đã hết giờ bốc thăm</h2>
          <p className="text-lg mb-6">Rất tiếc, thời gian bốc thăm quy định cho cô/thầy <strong>{user.name}</strong> đã kết thúc.</p>
          <div className="bg-white/50 p-4 rounded-lg space-y-2">
             <div className="flex justify-between items-center text-sm border-b border-red-100 pb-2">
                <span className="text-red-900/60">Bắt đầu:</span>
                <span className="font-mono font-semibold text-red-700">{formatDate(startTime)}</span>
             </div>
             <div className="flex justify-between items-center text-sm pt-1">
                <span className="text-red-900/60">Kết thúc:</span>
                <span className="font-mono font-semibold text-red-700">{formatDate(endTime)}</span>
             </div>
          </div>
          <p className="mt-6 text-sm text-red-900/60">Vui lòng liên hệ quản trị viên để được hỗ trợ.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <header className="text-center space-y-3">
        <h1 className="text-3xl font-bold text-slate-800">Bốc Thăm Bài Dạy</h1>
        <p className="text-slate-600">Giáo viên: <span className="font-semibold text-blue-600">{user.name}</span></p>
        {user.subjectGroup && <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full">Môn: {user.subjectGroup}</span>}
        
        <div className="bg-white border border-slate-200 rounded-xl p-4 max-w-lg mx-auto shadow-sm mt-4">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center justify-center gap-2">
               <CalendarDays className="w-4 h-4" /> Thời Gian Quy Định
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex flex-col items-center p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 text-xs mb-1">Thời gian bắt đầu</span>
                    <span className="font-bold text-slate-700">{formatDate(startTime)}</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 text-xs mb-1">Thời gian kết thúc</span>
                    <span className="font-bold text-slate-700">{formatDate(endTime)}</span>
                </div>
            </div>
            
            {!result && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex justify-center items-center gap-2 text-xs text-slate-500">
                <Clock className="w-3 h-3 text-green-500" />
                <span>Còn lại: {endTime > now ? (
                  <span className="text-green-600 font-bold">
                    {Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 60000))} phút
                  </span>
                ) : "Đã hết giờ"}</span>
              </div>
            )}
        </div>
      </header>

      {/* Result Card */}
      {result ? (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-8 text-center shadow-lg relative overflow-hidden animate-fade-in">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 to-emerald-500"></div>
          <Sparkles className="w-12 h-12 text-green-500 mx-auto mb-4 animate-bounce" />
          <h2 className="text-2xl font-bold text-green-800 mb-2">Kết Quả Bốc Thăm</h2>
          <p className="text-green-700 mb-6">Chúc mừng thầy/cô đã bốc thăm thành công!</p>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-green-100 inline-block text-left w-full max-w-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-slate-400 uppercase tracking-wide">Môn học</span>
                <p className="font-semibold text-slate-800">{result.subject}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400 uppercase tracking-wide">Khối lớp</span>
                <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800">{result.grade}</p>
                    {user.drawnClass && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold border border-blue-200">
                            Lớp: {user.drawnClass}
                        </span>
                    )}
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-400 uppercase tracking-wide">Tuần / Tiết</span>
                <p className="font-semibold text-slate-800">Tuần {result.week} - Tiết {result.period}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
               <span className="text-xs text-slate-400 uppercase tracking-wide">Tên bài dạy</span>
               <p className="text-xl font-bold text-blue-600 mt-1">{result.name}</p>
            </div>
          </div>
          
          <div className="mt-8 text-xs text-slate-500">
            Kết quả đã được ghi nhận vào hệ thống lúc {new Date().toLocaleTimeString()}.
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-500" />
              Lựa chọn khối lớp
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              {isSpecialSubject ? (
                 <span>Đối với môn <strong className="text-blue-600">{user.subjectGroup}</strong>, quy định bắt buộc phải chọn <strong>đủ 2 khối lớp</strong>. </span>
              ) : (
                 <span>Vui lòng chọn <strong>1 hoặc tối đa 2 khối lớp</strong> mong muốn giảng dạy. </span>
              )}
              Hệ thống sẽ chọn ngẫu nhiên bài giảng trong các khối đã chọn, đồng thời <strong>ưu tiên các tiết chưa có người bốc</strong>.
            </p>
          </div>
          
          <div className="p-8">
            {availableGrades.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-8">
                {availableGrades.map((grade) => {
                  const isSelected = selectedGrades.includes(grade);
                  
                  return (
                    <button
                      key={grade}
                      onClick={() => toggleGrade(grade)}
                      className={`
                        relative p-4 rounded-xl border-2 transition-all duration-200 text-sm font-medium
                        ${isSelected 
                          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md transform scale-105' 
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}
                      `}
                    >
                      {isSelected && (
                        <div className="absolute -top-2 -right-2 bg-blue-500 text-white rounded-full p-0.5">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                      {grade}
                    </button>
                  );
                })}
              </div>
            ) : (
               <div className="mb-8 p-4 bg-slate-100 text-slate-500 rounded-lg text-center">
                 Chưa có dữ liệu khối lớp. Vui lòng liên hệ Admin.
               </div>
            )}

            {error && (
              <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-700 flex items-center gap-3 animate-pulse">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleDraw}
              disabled={isDrawing || selectedGrades.length === 0}
              className={`
                w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg transition-all
                ${isDrawing || selectedGrades.length === 0
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transform hover:-translate-y-0.5'}
              `}
            >
              {isDrawing ? (
                <span className="flex items-center justify-center gap-3">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang bốc thăm ngẫu nhiên...
                </span>
              ) : (
                "BỐC THĂM NGAY"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
