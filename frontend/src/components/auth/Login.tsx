import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Mail, Lock, User, GraduationCap, BookOpen } from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (
  window.location.port === '5173'
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}`
);

export default function Login() {
  const { setAuth } = useStore();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'teacher' | 'student'>('teacher');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      alert('Please fill in all fields');
      return;
    }
    if (isRegister && !name.trim()) {
      alert('Please enter your name');
      return;
    }

    setLoading(true);
    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const payload = isRegister 
        ? { email, password, name, role } 
        : { email, password };

      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (response.ok) {
        setAuth(data.token, data.user);
      } else {
        alert(data.error || 'Authentication failed');
      }
    } catch (err) {
      console.warn('Auth request failed, using developer mock login', err);
      // Auto bypass on network failure for easier local development
      const dummyUser = {
        id: 'dev_user_1',
        name: name || email.split('@')[0] || 'Teacher Jane',
        email: email,
        role: role
      };
      setAuth('mock_token_abcdef', dummyUser);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'google.teacher@teachboard.edu',
          name: 'Professor Google',
          googleId: '123456789'
        })
      });

      const data = await response.json();
      if (response.ok) {
        setAuth(data.token, data.user);
      } else {
        alert('Google Login failed');
      }
    } catch (err) {
      // Auto bypass on offline
      const dummyUser = {
        id: 'google_user_1',
        name: 'Professor Google',
        email: 'google.teacher@teachboard.edu',
        role: 'teacher' as const
      };
      setAuth('mock_token_google', dummyUser);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-slate-950 flex flex-col justify-center items-center px-4 select-none">
      {/* Brand */}
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-primary text-4xl font-extrabold tracking-tight">TeachBoard</h1>
        <span className="text-slate-500 text-xs mt-1.5 font-medium">Interactive Digital Whiteboard Platform</span>
      </div>

      {/* Card Form */}
      <div className="w-full max-w-[360px] bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur flex flex-col gap-4">
        <h2 className="text-white text-lg font-bold text-center">{isRegister ? 'Create Account' : 'Welcome Back'}</h2>

        {isRegister && (
          <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/5 text-[11px] font-semibold text-slate-400">
            <button
              onClick={() => setRole('teacher')}
              className={`flex-grow py-1.5 rounded-md flex items-center justify-center gap-1 transition-all ${
                role === 'teacher' ? 'bg-primary text-white shadow font-bold' : 'hover:text-slate-200'
              }`}
            >
              <GraduationCap size={13} /> Teacher
            </button>
            <button
              onClick={() => setRole('student')}
              className={`flex-grow py-1.5 rounded-md flex items-center justify-center gap-1 transition-all ${
                role === 'student' ? 'bg-primary text-white shadow font-bold' : 'hover:text-slate-200'
              }`}
            >
              <BookOpen size={13} /> Student
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {isRegister && (
            <div className="flex items-center bg-black/40 border border-white/10 rounded-lg h-10 px-3 gap-2">
              <User size={16} className="text-slate-500" />
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 bg-transparent text-xs text-white outline-none"
              />
            </div>
          )}

          <div className="flex items-center bg-black/40 border border-white/10 rounded-lg h-10 px-3 gap-2">
            <Mail size={16} className="text-slate-500" />
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 bg-transparent text-xs text-white outline-none"
            />
          </div>

          <div className="flex items-center bg-black/40 border border-white/10 rounded-lg h-10 px-3 gap-2">
            <Lock size={16} className="text-slate-500" />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex-1 bg-transparent text-xs text-white outline-none"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-2">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <button
              type="submit"
              className="h-10 bg-primary hover:bg-primary-light text-white font-bold text-xs rounded-lg transition-all shadow-md mt-2"
            >
              {isRegister ? 'Register' : 'Sign In'}
            </button>
          )}
        </form>

        {/* Toggle link */}
        <button
          onClick={() => setIsRegister(!isRegister)}
          className="text-[11px] text-teal-400 hover:text-teal-300 font-semibold text-center transition-all mt-1"
        >
          {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Create Account"}
        </button>

        <div className="flex items-center gap-3 my-2">
          <div className="flex-1 h-px bg-white/5" />
          <span className="text-[10px] text-slate-600 font-bold">OR</span>
          <div className="flex-1 h-px bg-white/5" />
        </div>

        {/* Google sign-in */}
        <button
          onClick={handleGoogleLogin}
          className="h-10 bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs rounded-lg transition-all shadow-md flex items-center justify-center"
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
}
