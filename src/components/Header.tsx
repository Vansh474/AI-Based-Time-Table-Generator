import React, { useState } from 'react';
import { Search, LogOut, User as UserIcon, Save, AlertCircle, KeyRound, X } from 'lucide-react';
import { User } from '../types';
import { usePersistence } from '../contexts/PersistenceContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../lib/api';

interface HeaderProps {
  user: User;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  onLogout: () => void;
}

export default function Header({ user, isDarkMode, setIsDarkMode, onLogout }: HeaderProps) {
  const { triggerGlobalSave, syncStatus, isDirty } = usePersistence();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    if (!currentPassword) {
      setPwdError('Current password is required.');
      return;
    }
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPwdError('New password must be at least 8 characters and include letters and numbers.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('New passwords do not match.');
      return;
    }

    setSavingPwd(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setPwdSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowChangePassword(false);
        setPwdSuccess('');
      }, 1200);
    } catch (err: any) {
      setPwdError(err.message || 'Failed to update password.');
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 px-6 md:px-8 flex items-center justify-between z-30 transition-colors">
        <div className="flex-1 max-w-xl group relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
          <input
            type="text"
            placeholder="Search subjects, schedules, or teachers..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-12 pr-4 text-sm outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-800"
          />
        </div>

        <div className="flex items-center gap-6 ml-8">
          <div className="flex items-center gap-2">
            <AnimatePresence mode="wait">
              {isDirty && syncStatus === 'synced' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-2"
                >
                  <div className="flex flex-col items-end mr-1">
                    <span className="text-[9px] font-bold text-amber-600 uppercase tracking-tighter leading-none">
                      Unsaved
                    </span>
                    <span className="text-[8px] text-slate-400 font-medium leading-none">Changes pending</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={triggerGlobalSave}
              disabled={syncStatus === 'syncing'}
              title="Save everything to cloud"
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm border',
                syncStatus === 'syncing'
                  ? 'bg-slate-50 text-slate-400 border-slate-200'
                  : syncStatus === 'synced' && isDirty
                  ? 'bg-amber-500 text-white border-amber-600 shadow-amber-500/20 hover:bg-amber-600'
                  : syncStatus === 'synced'
                  ? 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  : 'bg-rose-500 text-white border-rose-600'
              )}
            >
              {syncStatus === 'syncing' ? (
                <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              ) : syncStatus === 'synced' ? (
                <Save className={cn('w-3.5 h-3.5', isDirty && 'animate-pulse')} />
              ) : (
                <AlertCircle className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">
                {syncStatus === 'syncing'
                  ? 'Saving All...'
                  : syncStatus === 'synced' && isDirty
                  ? 'Save All Changes'
                  : syncStatus === 'synced'
                  ? 'All Data Saved'
                  : 'Save Error'}
              </span>
            </button>
          </div>

          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-500">
            <a href="#" className="text-indigo-600 hover:text-indigo-700">
              Dashboard
            </a>
            <a href="#" className="hover:text-slate-800">
              Resources
            </a>
            <a href="#" className="hover:text-slate-800">
              Analytics
            </a>
          </nav>

          <div className="h-6 w-px bg-slate-200"></div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full uppercase tracking-tighter">
                {user.role}
              </span>
            </div>
            <div className="relative group">
              <button className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                <UserIcon className="w-4 h-4 text-slate-500" />
              </button>
              <div className="absolute top-10 right-0 w-48 bg-white border border-slate-200 rounded-lg shadow-xl opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all p-1">
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <p className="text-xs font-bold text-slate-900">{user.name}</p>
                  <p className="text-[10px] text-slate-500">{user.email}</p>
                </div>
                <button
                  onClick={() => {
                    setPwdError('');
                    setPwdSuccess('');
                    setShowChangePassword(true);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded text-slate-700 hover:bg-slate-50 transition-all text-xs font-semibold"
                >
                  <KeyRound className="w-3 h-3" />
                  Change Password
                </button>
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded text-rose-600 hover:bg-rose-50 transition-all text-xs font-semibold"
                >
                  <LogOut className="w-3 h-3" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {showChangePassword && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleChangePassword}
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Change Password</h3>
              <button
                type="button"
                onClick={() => setShowChangePassword(false)}
                className="p-2 hover:bg-slate-50 rounded-xl"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {pwdError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-600 p-3 rounded-lg text-xs font-semibold">
                {pwdError}
              </div>
            )}
            {pwdSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-lg text-xs font-semibold">
                {pwdSuccess}
              </div>
            )}

            <div>
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-1.5">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-1.5">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 chars with letters & numbers"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setShowChangePassword(false)}
                className="flex-1 py-2.5 text-slate-500 font-bold hover:bg-slate-50 rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingPwd}
                className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 text-sm"
              >
                {savingPwd ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
