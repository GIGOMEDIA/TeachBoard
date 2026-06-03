import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { LogOut, Plus, Play, Users, Clock, BookOpen, BarChart2 } from 'lucide-react';

const BACKEND_URL = 'http://localhost:5000';

interface DashboardProps {
  setView: (view: 'dashboard' | 'classroom') => void;
}

export default function Dashboard({ setView }: DashboardProps) {
  const { user, token, logout, connectRoom } = useStore();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);

  // Forms
  const [classCodeInput, setClassCodeInput] = useState('');
  const [newClassTitle, setNewClassTitle] = useState('');
  const [newClassSubject, setNewClassSubject] = useState('');
  const [isCreatingClass, setIsCreatingClass] = useState(false);

  useEffect(() => {
    fetchDashboardStats();
  }, [user]);

  const fetchDashboardStats = async () => {
    if (!token || !user) return;
    setLoading(true);
    try {
      const endpoint = user.role === 'teacher' ? '/api/dashboard/teacher/stats' : '/api/dashboard/student/stats';
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setStats(data);
      } else {
        console.error(data.error);
      }
    } catch (err) {
      console.warn('Dashboard stats fetch failed, using fallback mocks', err);
      // Fallback mocks
      if (user.role === 'teacher') {
        setStats({
          totalStudents: 48,
          activeClassesCount: 1,
          recordedLessonsCount: 6,
          teachingMinutes: 240,
          recentClasses: [
            { id: 1, code: 'MATH11', subject: 'Calculus', title: 'Derivatives & Integrals', active: 1 }
          ]
        });
      } else {
        setStats({
          joinedClassesCount: 3,
          lessonHistoryCount: 8,
          pendingHomeworkCount: 1,
          recentQuizScore: '90%',
          availableClasses: [
            { id: 1, code: 'MATH11', subject: 'Calculus', title: 'Derivatives & Integrals', teacher_name: 'Dr. John Smith', active: 1 }
          ]
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClass = () => {
    if (!classCodeInput.trim() || classCodeInput.length !== 6) {
      alert('Please enter a valid 6-character room code');
      return;
    }
    connectRoom(classCodeInput);
    setView('classroom');
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassTitle.trim() || !newClassSubject.trim()) {
      alert('Please enter title and subject');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/dashboard/class`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newClassTitle,
          subject: newClassSubject
        })
      });

      const data = await response.json();
      if (response.ok) {
        setIsCreatingClass(false);
        setNewClassTitle('');
        setNewClassSubject('');
        fetchDashboardStats();
        
        // Connect immediately
        connectRoom(data.code);
        setView('classroom');
      } else {
        alert(data.error || 'Failed to create classroom');
      }
    } catch (err) {
      alert('Failed to connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col p-6 overflow-y-auto">
      {/* Header */}
      <header className="flex justify-between items-center pb-6 border-b border-white/5">
        <div>
          <span className="text-slate-500 text-xs tracking-wide">WELCOME BACK,</span>
          <h1 className="text-white text-xl font-bold mt-0.5">{user?.name || 'Instructor'}</h1>
        </div>
        <button
          onClick={handleLogout}
          className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all border border-red-500/10"
        >
          <LogOut size={16} />
        </button>
      </header>

      {loading && !stats ? (
        <div className="flex-1 flex justify-center items-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <main className="flex-1 flex flex-col md:flex-row gap-6 mt-6">
          {/* Left panel - Main Actions & Stats */}
          <div className="flex-1 flex flex-col gap-6">
            {/* Class Management Action card */}
            {user?.role === 'teacher' ? (
              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
                <h2 className="text-white font-bold text-base">Host Virtual Whiteboard</h2>
                {!isCreatingClass ? (
                  <button
                    onClick={() => setIsCreatingClass(true)}
                    className="h-11 bg-primary hover:bg-primary-light text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-lg"
                  >
                    <Plus size={16} /> Setup New Lesson
                  </button>
                ) : (
                  <form onSubmit={handleCreateClass} className="flex flex-col gap-3">
                    <input
                      type="text"
                      placeholder="Lesson Title (e.g. Intro to Trigonometry)"
                      value={newClassTitle}
                      onChange={(e) => setNewClassTitle(e.target.value)}
                      className="h-10 bg-black/40 border border-white/10 rounded-lg px-3 text-xs text-white outline-none focus:border-primary/50"
                    />
                    <input
                      type="text"
                      placeholder="Subject (e.g. Mathematics)"
                      value={newClassSubject}
                      onChange={(e) => setNewClassSubject(e.target.value)}
                      className="h-10 bg-black/40 border border-white/10 rounded-lg px-3 text-xs text-white outline-none focus:border-primary/50"
                    />
                    <div className="flex gap-2 text-xs font-semibold mt-1">
                      <button
                        type="button"
                        onClick={() => setIsCreatingClass(false)}
                        className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700/80 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-2 bg-primary text-white rounded-lg hover:bg-primary-light transition-all"
                      >
                        Launch Board
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
                <h2 className="text-white font-bold text-base">Join Live Lesson</h2>
                <p className="text-slate-400 text-xs leading-relaxed">Enter the 6-character room code shared by your teacher to connect to their interactive board:</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="E.g. A9B8C7"
                    maxLength={6}
                    value={classCodeInput}
                    onChange={(e) => setClassCodeInput(e.target.value.toUpperCase())}
                    className="flex-1 h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-center text-sm font-bold text-white tracking-widest outline-none focus:border-teal-500/50"
                  />
                  <button
                    onClick={handleJoinClass}
                    className="px-6 bg-teal-500 text-slate-950 hover:bg-teal-400 font-bold text-xs rounded-xl transition-all shadow-md"
                  >
                    Enter Room
                  </button>
                </div>
              </div>
            )}

            {/* Metrics grid */}
            <div>
              <span className="text-[10px] text-slate-500 font-bold tracking-wide uppercase">Teaching Analytics</span>
              <div className="grid grid-cols-2 gap-4 mt-3">
                {user?.role === 'teacher' ? (
                  <>
                    <div className="bg-slate-900/40 border border-white/5 p-4 rounded-xl flex flex-col items-start gap-1">
                      <Users size={18} className="text-primary-light" />
                      <span className="text-xl font-bold text-slate-100 mt-2">{stats?.totalStudents || 0}</span>
                      <span className="text-[10px] text-slate-500">Total Students</span>
                    </div>
                    <div className="bg-slate-900/40 border border-white/5 p-4 rounded-xl flex flex-col items-start gap-1">
                      <Clock size={18} className="text-teal-400" />
                      <span className="text-xl font-bold text-slate-100 mt-2">{stats?.teachingMinutes || 0}m</span>
                      <span className="text-[10px] text-slate-500">Teaching Minutes</span>
                    </div>
                    <div className="bg-slate-900/40 border border-white/5 p-4 rounded-xl flex flex-col items-start gap-1">
                      <BookOpen size={18} className="text-sky-400" />
                      <span className="text-xl font-bold text-slate-100 mt-2">{stats?.activeClassesCount || 0}</span>
                      <span className="text-[10px] text-slate-500">Active Classes</span>
                    </div>
                    <div className="bg-slate-900/40 border border-white/5 p-4 rounded-xl flex flex-col items-start gap-1">
                      <BarChart2 size={18} className="text-amber-500" />
                      <span className="text-xl font-bold text-slate-100 mt-2">{stats?.recordedLessonsCount || 0}</span>
                      <span className="text-[10px] text-slate-500">Screen Recordings</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-slate-900/40 border border-white/5 p-4 rounded-xl flex flex-col items-start gap-1">
                      <BookOpen size={18} className="text-primary-light" />
                      <span className="text-xl font-bold text-slate-100 mt-2">{stats?.joinedClassesCount || 0}</span>
                      <span className="text-[10px] text-slate-500">Joined Classes</span>
                    </div>
                    <div className="bg-slate-900/40 border border-white/5 p-4 rounded-xl flex flex-col items-start gap-1">
                      <Clock size={18} className="text-teal-400" />
                      <span className="text-xl font-bold text-slate-100 mt-2">{stats?.lessonHistoryCount || 0}</span>
                      <span className="text-[10px] text-slate-500">Lesson History</span>
                    </div>
                    <div className="bg-slate-900/40 border border-white/5 p-4 rounded-xl flex flex-col items-start gap-1">
                      <Users size={18} className="text-red-400" />
                      <span className="text-xl font-bold text-slate-100 mt-2">{stats?.pendingHomeworkCount || 0}</span>
                      <span className="text-[10px] text-slate-500">Pending Homework</span>
                    </div>
                    <div className="bg-slate-900/40 border border-white/5 p-4 rounded-xl flex flex-col items-start gap-1">
                      <BarChart2 size={18} className="text-amber-500" />
                      <span className="text-xl font-bold text-slate-100 mt-2">{stats?.recentQuizScore || '0%'}</span>
                      <span className="text-[10px] text-slate-500">Avg. Quiz Score</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right panel - Available lessons / rooms history */}
          <div className="w-full md:w-80 flex flex-col gap-3">
            <span className="text-[10px] text-slate-500 font-bold tracking-wide uppercase">
              {user?.role === 'teacher' ? 'Your Active Sessions' : 'Available Active Rooms'}
            </span>

            <div className="flex flex-col gap-2.5 max-h-[360px] overflow-y-auto pr-1">
              {user?.role === 'teacher' ? (
                (stats?.recentClasses || []).length === 0 ? (
                  <span className="text-xs text-slate-500 text-center py-6 border border-white/5 border-dashed rounded-xl">No active classrooms. Host a new lesson to start.</span>
                ) : (
                  (stats?.recentClasses || []).map((c: any) => (
                    <div key={c.id} className="bg-slate-900/40 border border-white/5 p-3 rounded-xl flex items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-semibold text-slate-500">{c.subject}</span>
                        <h4 className="text-xs font-bold text-slate-200 truncate max-w-[150px] mt-0.5">{c.title}</h4>
                        <span className="text-[10px] text-primary-light font-mono mt-0.5 block">Code: {c.code}</span>
                      </div>
                      <button
                        onClick={() => {
                          connectRoom(c.code);
                          setView('classroom');
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 border border-primary/20 hover:bg-primary text-primary-light hover:text-white rounded-lg text-[11px] font-bold transition-all"
                      >
                        <Play size={10} /> Resume
                      </button>
                    </div>
                  ))
                )
              ) : (
                (stats?.availableClasses || []).length === 0 ? (
                  <span className="text-xs text-slate-500 text-center py-6 border border-white/5 border-dashed rounded-xl font-medium">No live lessons found. Ask your teacher for code.</span>
                ) : (
                  (stats?.availableClasses || []).map((c: any) => (
                    <div key={c.id} className="bg-slate-900/40 border border-white/5 p-3 rounded-xl flex items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-semibold text-slate-500">{c.subject} · {c.teacher_name}</span>
                        <h4 className="text-xs font-bold text-slate-200 truncate max-w-[150px] mt-0.5">{c.title}</h4>
                        <span className="text-[10px] text-teal-400 font-mono mt-0.5 block">Code: {c.code}</span>
                      </div>
                      <button
                        onClick={() => {
                          connectRoom(c.code);
                          setView('classroom');
                        }}
                        className="px-3 py-1.5 bg-teal-500/10 border border-teal-500/20 hover:bg-teal-500 text-teal-400 hover:text-slate-950 rounded-lg text-[11px] font-bold transition-all"
                      >
                        Join
                      </button>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
