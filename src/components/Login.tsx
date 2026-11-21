import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { User } from '../types';
import { LogIn, GraduationCap, ShieldCheck } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User, token: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [needsAdminSetup, setNeedsAdminSetup] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .getSetupStatus()
      .then((res) => {
        if (active) {
          setNeedsAdminSetup(Boolean(res?.needsInitialAdminSetup));
        }
      })
      .catch(() => {
        // Default to standard login view if status check fails
      })
      .finally(() => {
        if (active) setCheckingSetup(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid work email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.login({ email: trimmedEmail, password });
      onLogin(response.user, response.token);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter the administrator email address.');
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must be at least 8 characters and include both letters and numbers.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.setupAdmin({ email: trimmedEmail, password });
      onLogin(response.user, response.token);
    } catch (err: any) {
      setError(err.message || 'Initial administrator setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-8 shadow-xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-4 shadow-sm">
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            SmartTimetable <span className="text-indigo-600 font-bold">AI</span>
          </h1>
          <p className="text-slate-500 text-sm mt-2 font-medium">
            {needsAdminSetup ? 'Initial Administrator Password Setup' : 'Enterprise Scheduling Solution'}
          </p>
        </div>

        {checkingSetup ? (
          <div className="py-10 flex justify-center">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : needsAdminSetup ? (
          <form onSubmit={handleSetupSubmit} className="space-y-5" noValidate>
            <div className="bg-indigo-50 border border-indigo-100 text-indigo-800 p-3.5 rounded-lg text-xs leading-relaxed">
              No administrator password is configured yet. Enter your existing administrator email and choose a strong initial password to secure your workspace.
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-600 p-3 rounded-lg text-xs font-semibold">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">
                Administrator Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder-slate-300 text-sm"
                placeholder="name@college.edu"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder-slate-300 text-sm"
                placeholder="At least 8 chars with letters & numbers"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder-slate-300 text-sm"
                placeholder="Re-enter password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3.5 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-md"
            >
              {loading ? 'Securing Account...' : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Set Admin Password &amp; Continue
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLoginSubmit} className="space-y-5" noValidate>
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-600 p-3 rounded-lg text-xs font-semibold">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">
                Work Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder-slate-300 text-sm"
                placeholder="name@college.edu"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">
                Secure Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder-slate-300 text-sm"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3.5 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-md"
            >
              {loading ? 'Authenticating...' : (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In to Platform
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
