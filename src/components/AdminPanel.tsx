import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { api } from '../lib/api';
import { Plus, Trash2, Edit3, Save, X, BookOpen, Users, MapPin, Settings as SettingsIcon, Clock, KeyRound, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';
import { usePersistence } from '../contexts/PersistenceContext';

interface AdminPanelProps {
  activeTab: string;
}

export default function AdminPanel({ activeTab }: AdminPanelProps) {
  const [data, setData] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [passwordTarget, setPasswordTarget] = useState<any>(null);
  const [newUserPassword, setNewUserPassword] = useState('');
  const [confirmUserPassword, setConfirmUserPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [globalSaveStatus, setGlobalSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const { setSyncStatus, setIsDirty, onGlobalSave } = usePersistence();

  const getEmptyItem = (tab: string) => {
    switch (tab) {
      case 'subjects': return { name: '', code: '', credits: 3, weeklyFrequency: 3, type: 'theory' };
      case 'teachers': return { name: '', email: '', maxLecturesPerDay: 4, subjects: [], unavailableSlots: [] };
      case 'rooms': return { name: '', capacity: 60, type: 'theory' };
      case 'sections': return { name: '', studentCount: 50 };
      case 'slots': return { name: 'New Slot', startTime: '08:00', endTime: '09:00', isBreak: false };
      default: return { name: '' };
    }
  };

  const handleGlobalSave = useCallback(async () => {
    if (!data) return;
    setGlobalSaveStatus('saving');
    setSyncStatus('syncing');
    try {
      await api.saveSettings(data);
      setGlobalSaveStatus('saved');
      setSyncStatus('synced');
      setIsDirty(false);
      setTimeout(() => setGlobalSaveStatus('idle'), 2000);
    } catch (err) {
      console.error(err);
      setGlobalSaveStatus('failed');
      setSyncStatus('error');
      setTimeout(() => setGlobalSaveStatus('idle'), 3000);
      throw err;
    }
  }, [data, setSyncStatus, setIsDirty]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  useEffect(() => {
    if (data) {
      return onGlobalSave(handleGlobalSave);
    }
  }, [data, onGlobalSave, handleGlobalSave]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'settings') {
        const users = await api.getUsers();
        setUsersList(Array.isArray(users) ? users : []);
      } else {
        const res = await api.getSchema();
        setData(res);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetUserPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!passwordTarget) return;
    setPasswordError('');
    setPasswordSuccess('');

    if (
      newUserPassword.length < 8 ||
      !/[A-Za-z]/.test(newUserPassword) ||
      !/[0-9]/.test(newUserPassword)
    ) {
      setPasswordError('Password must be at least 8 characters and include letters and numbers.');
      return;
    }
    if (newUserPassword !== confirmUserPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const res = await api.setUserPassword(passwordTarget.id, newUserPassword);
      setUsersList((prev) => prev.map((u) => (u.id === passwordTarget.id ? res.user : u)));
      setPasswordSuccess(`Password updated for ${passwordTarget.email}.`);
      setPasswordTarget(null);
      setNewUserPassword('');
      setConfirmUserPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password.');
    } finally {
      setSaving(false);
    }
  };

  const currentList = data && activeTab !== 'settings' ? (data[activeTab] || []) : [];

  const handleSave = async (item: any) => {
    // If it's a slot and name is missing, use timings as name
    let nameToUse = item.name;
    if (activeTab === 'slots' && !nameToUse?.trim()) {
      nameToUse = `${item.startTime} - ${item.endTime}`;
    }

    if (!nameToUse?.trim()) {
      alert("Name is required");
      return;
    }

    setSaving(true);
    setSyncStatus('syncing');
    // Better ID prefix to avoid collision between Subjects, Sections, and Slots (all used 's' previously)
    const prefixes: any = {
      subjects: 'sub',
      sections: 'sec',
      slots: 'slo',
      teachers: 'tea',
      rooms: 'rom'
    };
    const prefix = prefixes[activeTab] || activeTab.slice(0, 3);
    
    try {
      // Small optimization: Refetch latest data to ensure we have the newest counters/items
      const latestData = await api.getSchema();
      const currentListLatest = latestData[activeTab] || [];
      
      const newItem = { ...item, name: nameToUse };
      
      // Ensure arrays exist for specific types
      if (activeTab === 'teachers') {
        newItem.subjects = newItem.subjects || [];
        newItem.unavailableSlots = newItem.unavailableSlots || [];
        newItem.maxLecturesPerDay = newItem.maxLecturesPerDay || 4;
      }

      const updatedList = newItem.id 
        ? currentListLatest.map((i: any) => i.id === newItem.id ? newItem : i)
        : [...currentListLatest, { ...newItem, id: `${prefix}_${Date.now()}` }];
      
      // OPTIMIZATION: Only send the specific collection that changed
      const updatePayload = { [activeTab]: updatedList };
      await api.saveSettings(updatePayload);
      
      // Update local state by merging
      setData(prev => ({ ...prev, ...updatePayload }));
      setSyncStatus('synced');
      setIsDirty(false);
      setEditingItem(null);
    } catch (err: any) {
      console.error(err);
      setSyncStatus('error');
      alert("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderFields = () => {
    if (!editingItem) return null;

    return (
      <div className="space-y-4">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-1.5 px-1">Name</label>
          <input 
            type="text" 
            value={editingItem.name || ''} 
            onChange={e => setEditingItem({...editingItem, name: e.target.value})}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-medium"
            placeholder="Enter name..."
          />
        </div>

        {activeTab === 'subjects' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-1.5 px-1">Code</label>
                <input 
                  type="text" 
                  value={editingItem.code || ''} 
                  onChange={e => setEditingItem({...editingItem, code: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-medium"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-1.5 px-1">Credits</label>
                <input 
                  type="number" 
                  value={editingItem.credits || 0} 
                  onChange={e => setEditingItem({...editingItem, credits: parseInt(e.target.value) || 0})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-medium"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-1.5 px-1">Weekly Freq</label>
                <input 
                  type="number" 
                  value={editingItem.weeklyFrequency || 0} 
                  onChange={e => setEditingItem({...editingItem, weeklyFrequency: parseInt(e.target.value) || 0})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-medium"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-1.5 px-1">Type</label>
                <select 
                  value={editingItem.type || 'theory'} 
                  onChange={e => setEditingItem({...editingItem, type: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-medium"
                >
                  <option value="theory">Theory</option>
                  <option value="lab">Lab</option>
                </select>
              </div>
            </div>
          </>
        )}

        {activeTab === 'teachers' && (
          <>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-1.5 px-1">Email</label>
              <input 
                type="email" 
                value={editingItem.email || ''} 
                onChange={e => setEditingItem({...editingItem, email: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-medium"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-1.5 px-1">Max Daily Load</label>
                <input 
                  type="number" 
                  value={editingItem.maxLecturesPerDay || 4} 
                  onChange={e => setEditingItem({...editingItem, maxLecturesPerDay: parseInt(e.target.value) || 0})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-medium"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-1.5 px-1">Weekly Target</label>
                <div className="w-full bg-slate-100 border border-slate-200 rounded-lg p-3 text-slate-400 text-sm font-medium">
                  { (editingItem.maxLecturesPerDay || 4) * (data.days?.length || 5) } Lect/Week
                </div>
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-1.5 px-1">Subjects Handled</label>
              <div className="flex flex-wrap gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg max-h-32 overflow-y-auto">
                {data.subjects.map((s: any) => {
                  const isSelected = editingItem.subjects?.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        const current = editingItem.subjects || [];
                        const next = isSelected ? current.filter((id: string) => id !== s.id) : [...current, s.id];
                        setEditingItem({...editingItem, subjects: next});
                      }}
                      className={cn(
                        "px-2 py-1 rounded text-[10px] font-bold transition-all border",
                        isSelected ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" : "bg-white text-slate-500 border-slate-200 hover:border-indigo-300"
                      )}
                    >
                      {s.name} ({s.code})
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-1.5 px-1">Availability Profile (Unavailable Slots)</label>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="grid grid-cols-5 gap-1">
                  {data.days.map((day: any) => (
                    <div key={day.id} className="space-y-1">
                      <div className="text-[8px] font-bold text-slate-400 uppercase text-center mb-1">{day.name.slice(0,3)}</div>
                      {data.slots.filter((s: any) => !s.isBreak).map((slot: any) => {
                        const slotId = `${slot.id}_${day.id}`;
                        const isUnavailable = editingItem.unavailableSlots?.includes(slotId);
                        return (
                          <button
                            key={slotId}
                            type="button"
                            onClick={() => {
                              const current = editingItem.unavailableSlots || [];
                              const next = isUnavailable ? current.filter((id: string) => id !== slotId) : [...current, slotId];
                              setEditingItem({...editingItem, unavailableSlots: next});
                            }}
                            title={`${day.name} ${slot.startTime}`}
                            className={cn(
                              "w-full aspect-square rounded-sm border transition-all",
                              isUnavailable ? "bg-rose-500 border-rose-600" : "bg-emerald-500 border-emerald-600 hover:opacity-80"
                            )}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-slate-400 mt-2 italic">* Green: Available | Red: Unavailable (Click to toggle)</p>
              </div>
            </div>
          </>
        )}

        {activeTab === 'rooms' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-1.5 px-1">Capacity</label>
              <input 
                type="number" 
                value={editingItem.capacity || 0} 
                onChange={e => setEditingItem({...editingItem, capacity: parseInt(e.target.value) || 0})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-medium"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-1.5 px-1">Type</label>
              <select 
                value={editingItem.type || 'theory'} 
                onChange={e => setEditingItem({...editingItem, type: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-medium"
              >
                <option value="theory">Theory</option>
                <option value="lab">Lab</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'sections' && (
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-1.5 px-1">Student Count</label>
            <input 
              type="number" 
              value={editingItem.studentCount || 0} 
              onChange={e => setEditingItem({...editingItem, studentCount: parseInt(e.target.value) || 0})}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-medium"
            />
          </div>
        )}

        {activeTab === 'slots' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-1.5 px-1">Start Time</label>
                <input 
                  type="time" 
                  value={editingItem.startTime || ''} 
                  onChange={e => setEditingItem({...editingItem, startTime: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-medium"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-1.5 px-1">End Time</label>
                <input 
                  type="time" 
                  value={editingItem.endTime || ''} 
                  onChange={e => setEditingItem({...editingItem, endTime: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-medium"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <input 
                type="checkbox" 
                id="isBreak"
                checked={editingItem.isBreak || false} 
                onChange={e => setEditingItem({...editingItem, isBreak: e.target.checked})}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <label htmlFor="isBreak" className="text-xs font-bold text-slate-600 cursor-pointer">Mark as Recess / Break</label>
            </div>
          </>
        )}
      </div>
    );
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    setSaving(true);
    setSyncStatus('syncing');
    try {
      // Refetch latest to ensure consistency
      const latestData = await api.getSchema();
      const currentListLatest = latestData[activeTab] || [];
      const updatedList = currentListLatest.filter((i: any) => i.id !== id);
      
      const updatePayload = { [activeTab]: updatedList };
      await api.saveSettings(updatePayload);
      
      setData(prev => ({ ...prev, ...updatePayload }));
      setSyncStatus('synced');
    } catch (err: any) {
      console.error(err);
      setSyncStatus('error');
      alert("Failed to delete: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-20 text-center">Loading settings...</div>;

  if (activeTab === 'settings') {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-[#E4E3E0] gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#141414] rounded-2xl flex items-center justify-center shadow-xl">
              <SettingsIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight capitalize">Account &amp; Password Setup</h2>
              <p className="text-xs text-[#888] font-bold uppercase tracking-widest mt-1">
                User Access Control
              </p>
            </div>
          </div>
        </div>

        {passwordSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            {passwordSuccess}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {usersList.map((u) => (
            <div key={u.id} className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-slate-800 tracking-tight">{u.name}</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700">
                    {u.role}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{u.email}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span
                  className={cn(
                    'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded',
                    u.hasPassword ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  )}
                >
                  {u.hasPassword ? 'Password Set' : 'Setup Pending'}
                </span>
                <button
                  onClick={() => {
                    setPasswordTarget(u);
                    setNewUserPassword('');
                    setConfirmUserPassword('');
                    setPasswordError('');
                  }}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[11px] font-bold hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  {u.hasPassword ? 'Reset Password' : 'Set Password'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {passwordTarget && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
            <form
              onSubmit={handleSetUserPassword}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Configure User Password</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {passwordTarget.name} ({passwordTarget.email})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPasswordTarget(null)}
                  className="p-2 hover:bg-slate-50 rounded-xl transition-all"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {passwordError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-600 p-3 rounded-lg text-xs font-semibold">
                  {passwordError}
                </div>
              )}

              <div>
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-1.5 px-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="At least 8 chars with letters & numbers"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-1.5 px-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmUserPassword}
                  onChange={(e) => setConfirmUserPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                  required
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setPasswordTarget(null)}
                  className="flex-1 py-2.5 text-slate-500 font-bold hover:bg-slate-50 rounded-xl text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 text-sm"
                >
                  {saving ? 'Saving...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  const Icons: any = {
    subjects: BookOpen,
    teachers: Users,
    rooms: MapPin,
    sections: Users,
    slots: Clock,
    settings: SettingsIcon
  };

  const Icon = Icons[activeTab];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-[#E4E3E0] dark:border-[#222] gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#141414] dark:bg-white rounded-2xl flex items-center justify-center shadow-xl">
            <Icon className="w-6 h-6 text-white dark:text-black" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight dark:text-white capitalize">{activeTab}</h2>
            <p className="text-xs text-[#888] font-bold uppercase tracking-widest mt-1">Management Console</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleGlobalSave}
            disabled={globalSaveStatus === 'saving'}
            className={cn(
              "px-6 py-3 border border-slate-200 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm",
              globalSaveStatus === 'saved' && "text-emerald-600 bg-emerald-50 border-emerald-200",
              globalSaveStatus === 'failed' && "text-rose-600 bg-rose-50 border-rose-200"
            )}
          >
            {globalSaveStatus === 'saving' ? (
              <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            ) : globalSaveStatus === 'saved' ? (
              <Save className="w-4 h-4" />
            ) : globalSaveStatus === 'failed' ? (
              <X className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4 text-slate-400" />
            )}
            {globalSaveStatus === 'saving' ? 'Syncing...' : 
             globalSaveStatus === 'saved' ? 'Config Saved' : 
             globalSaveStatus === 'failed' ? 'Sync Failed' : 'Save Configuration'}
          </button>

          <button 
            onClick={() => setEditingItem(getEmptyItem(activeTab))}
            className="px-6 py-3 bg-[#F27D26] text-white rounded-2xl font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-orange-500/20"
          >
            <Plus className="w-5 h-5" />
            Add New {activeTab.slice(0, -1)}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {currentList.map((item: any) => (
          <div key={item.id} className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-slate-800 tracking-tight leading-tight">{item.name}</h3>
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-1">
                  {item.code || item.email || item.type || (activeTab === 'sections' ? 'Section' : '')}
                </p>
              </div>
              <div className="flex gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity opacity-100">
                <button onClick={() => setEditingItem({ ...item, subjects: item.subjects || [], unavailableSlots: item.unavailableSlots || [] })} className="p-1.5 hover:bg-indigo-50 rounded-lg transition-colors text-slate-400 hover:text-indigo-600">
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(item.id)} className="p-1.5 hover:bg-rose-50 rounded-lg transition-colors text-slate-400 hover:text-rose-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            
            <div className="pt-3 border-t border-slate-50">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span>Metric</span>
                <span className="text-slate-600">
                  {activeTab === 'subjects' ? `${item.credits || 0} Credits` : 
                   activeTab === 'teachers' ? `${item.maxLecturesPerDay || 4} Lect/Day` : 
                   activeTab === 'rooms' ? `${item.capacity || 0} Pax` : 
                   activeTab === 'slots' ? (item.isBreak ? 'Non-Teaching' : 'Active Lecture') :
                   `${item.studentCount || 0} Students`}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex items-center justify-between mb-6 sticky top-0 bg-white z-10 pb-2">
                <h3 className="text-lg font-bold tracking-tight text-slate-800">{editingItem.id ? 'Edit' : 'Create'} {activeTab.slice(0, -1)}</h3>
                <button onClick={() => setEditingItem(null)} className="p-2 hover:bg-slate-50 rounded-xl transition-all">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-6">
                {renderFields()}
              </div>
            </div>
            
            <div className="p-6 pt-4 border-t border-slate-100 flex gap-3 bg-slate-50/50">
              <button 
                onClick={() => setEditingItem(null)}
                className="flex-1 py-3 text-slate-400 font-bold hover:bg-slate-50 rounded-xl transition-all text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleSave(editingItem)}
                disabled={saving}
                className="flex-2 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-sm shadow-md"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Entity
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
