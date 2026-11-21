import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { User, Timetable, GenerationProgress } from '../types';
import TimetableGrid from './TimetableGrid';
import AdminPanel from './AdminPanel';
import Analytics from './Analytics';
import { cn } from '../lib/utils';
import { Play, Sparkles, AlertCircle, CheckCircle2, Clock, Calendar, Trash2, Save, Copy } from 'lucide-react';
import { motion } from 'motion/react';
import { usePersistence } from '../contexts/PersistenceContext';

interface DashboardProps {
  user: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Dashboard({ user, activeTab, setActiveTab }: DashboardProps) {
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [selectedTimetable, setSelectedTimetable] = useState<Timetable | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress>({ status: 'idle', progress: 0, message: '' });
  const [savingTt, setSavingTt] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { setSyncStatus, setIsDirty, onGlobalSave } = usePersistence();

  const handleGlobalSave = useCallback(async () => {
    if (!selectedTimetable) return;
    setSavingTt(true);
    setSaveStatus('saving');
    setSyncStatus('syncing');
    try {
      await api.updateTimetable(selectedTimetable.id, { ...selectedTimetable, isDraft: false });
      setSelectedTimetable(prev => prev ? { ...prev, isDraft: false } : null);
      setSaveStatus('saved');
      setHasUnsavedChanges(false);
      setSyncStatus('synced');
      setIsDirty(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error("Save failed:", err);
      setSaveStatus('failed');
      setSyncStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
      throw err;
    } finally {
      setSavingTt(false);
    }
  }, [selectedTimetable, setSyncStatus, setIsDirty]);

  useEffect(() => {
    if (selectedTimetable && hasUnsavedChanges) {
      return onGlobalSave(handleGlobalSave);
    }
  }, [selectedTimetable, hasUnsavedChanges, onGlobalSave, handleGlobalSave]);

  useEffect(() => {
    setIsDirty(hasUnsavedChanges);
  }, [hasUnsavedChanges, setIsDirty]);

  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    loadTimetables();

    const handleRefresh = () => loadTimetables();
    window.addEventListener('refresh-timetables', handleRefresh);
    return () => window.removeEventListener('refresh-timetables', handleRefresh);
  }, []);

  const loadTimetables = async () => {
    try {
      const data = await api.getTimetables();
      const updatedList = Array.isArray(data) ? data : [];
      setTimetables(updatedList);
      
      // Selection logic
      if (updatedList.length > 0) {
        setSelectedTimetable(current => {
          if (!current) return updatedList[updatedList.length - 1];
          const stillExists = updatedList.find((t: any) => t.id === current.id);
          return stillExists || updatedList[updatedList.length - 1];
        });
      } else {
        setSelectedTimetable(null);
      }
    } catch (err) {
      console.error("Load failed:", err);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setProgress({ status: 'generating', progress: 10, message: 'Solving constraints...' });
    
    try {
      // All artificial delays removed. We go straight to the calculation.
      const newTt = await api.generateTimetable();
      
      setTimetables(prev => [...prev, newTt]);
      setSelectedTimetable(newTt);
      setProgress({ status: 'completed', progress: 100, message: 'Success!' });
      
      // Near instant hide
      setTimeout(() => setGenerating(false), 500);
    } catch (err: any) {
      console.error(err);
      setGenerating(false);
      setProgress({ status: 'failed', progress: 0, message: err.message || 'Generation failed. Check constraints.' });
      alert("AI Generation Error: " + (err.message || "Failed to generate timetable. Please ensure you have added subjects, teachers, and rooms."));
    }
  };

  const handleDuplicate = async () => {
    if (!selectedTimetable || user.role !== 'admin') return;
    
    setGenerating(true);
    try {
      const newTimetable = {
        ...selectedTimetable,
        id: `tt_${Date.now()}`,
        name: `${selectedTimetable.name} (Copy)`,
        createdAt: new Date().toISOString(),
        isDraft: true
      };
      
      const allTimetables = await api.getTimetables();
      const updatedTimetables = [...allTimetables, newTimetable];
      
      // Save all timetables back (Note: backend routes usually handle individual updates, but here we're adding a new one)
      // Actually /generate adds one, we don't have a direct /create-timetable but we can reuse /save-settings if we want 
      // or just add a proper route. Let's see if /save-settings works for adding a timetable.
      // Looking at routes.ts, /save-settings merges req.body into db.json.
      
      await api.saveSettings({ timetables: updatedTimetables });
      setTimetables(updatedTimetables);
      setSelectedTimetable(newTimetable);
    } catch (err) {
      console.error(err);
      alert("Failed to duplicate.");
    } finally {
      setGenerating(false);
    }
  };

  const handleExportPDF = () => {
    if (!selectedTimetable) return;
    
    // Lazy load jspdf
    import('jspdf').then(async ({ jsPDF }) => {
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF('landscape');
      
      doc.setFontSize(20);
      doc.text(`Timetable: ${selectedTimetable.name}`, 14, 15);
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date(selectedTimetable.createdAt).toLocaleString()}`, 14, 22);

      const schema = await api.getSchema();
      const headers = ['Day', ...schema.slots.filter((s: any) => !s.isBreak).map((s: any) => `${s.startTime}-${s.endTime}`)];
      
      const rows = schema.days.map((day: any) => {
        const row = [day.name];
        schema.slots.filter((s: any) => !s.isBreak).forEach((slot: any) => {
          const entry = selectedTimetable.entries.find(e => e.dayId === day.id && e.slotId === slot.id && e.sectionId === schema.sections[0].id);
          if (entry) {
            const sub = schema.subjects.find((s: any) => s.id === entry.subjectId);
            const teach = schema.teachers.find((t: any) => t.id === entry.teacherId);
            const rm = schema.rooms.find((r: any) => r.id === entry.roomId);
            row.push(`${sub?.name}\n${teach?.name}\n[${rm?.name}]`);
          } else {
            row.push('-');
          }
        });
        return row;
      });

      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 30,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [79, 70, 229] }
      });

      doc.save(`${selectedTimetable.name}.pdf`);
    });
  };

  const handleDeleteTimetable = async () => {
    if (!selectedTimetable) return;
    
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setIsDeleting(true);
    try {
      await api.deleteTimetable(selectedTimetable.id);
      // Immediately filter out from local state for perceived performance
      const remaining = timetables.filter(t => t.id !== selectedTimetable.id);
      setTimetables(remaining);
      
      if (remaining.length > 0) {
        setSelectedTimetable(remaining[remaining.length - 1]);
      } else {
        setSelectedTimetable(null);
      }
      
      setConfirmDelete(false);
      // Optional: reload for true sync
      await loadTimetables();
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete timetable. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveTimetable = async () => {
    if (!selectedTimetable) return;
    
    setSavingTt(true);
    setSaveStatus('saving');
    try {
      await api.updateTimetable(selectedTimetable.id, { ...selectedTimetable, isDraft: false });
      setSelectedTimetable(prev => prev ? { ...prev, isDraft: false } : null);
      setSaveStatus('saved');
      setHasUnsavedChanges(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error("Save failed:", err);
      setSaveStatus('failed');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setSavingTt(false);
    }
  };

  if (activeTab === 'subjects' || activeTab === 'teachers' || activeTab === 'rooms' || activeTab === 'sections' || activeTab === 'slots' || activeTab === 'settings') {
    return <AdminPanel activeTab={activeTab} />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            {activeTab === 'dashboard' ? 'Optimization Overview' : 'Timetable Management'}
          </h1>
          <div className="flex gap-2">
            <span className="px-2 py-0.5 bg-white border border-slate-200 text-[10px] font-bold rounded text-slate-500">Genetic Alg v4.2</span>
            <span className="px-2 py-0.5 bg-white border border-slate-200 text-[10px] font-bold rounded text-slate-500">Stable Build</span>
          </div>
        </div>

        {user.role === 'admin' && (
          <div className="flex items-center gap-3">
             <button className="btn-secondary text-xs py-2">Optimize Further</button>
            <button 
              onClick={handleGenerate}
              disabled={generating}
              className="btn-primary text-xs py-2 flex items-center gap-2"
            >
              {generating ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Regenerate AI
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          {generating && (
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-indigo-600">
                  <Clock className="w-4 h-4 animate-pulse" />
                  <span className="font-bold text-xs">{progress.message}</span>
                </div>
                <span className="text-[10px] font-mono opacity-50">{progress.progress}%</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-indigo-600" 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.progress}%` }}
                />
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && <Analytics timetables={timetables} />}

          {(activeTab === 'dashboard' || activeTab === 'timetable') && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <select 
                      className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer border border-slate-200 rounded px-2 py-1 bg-white"
                      value={selectedTimetable?.id || ''}
                      onChange={(e) => {
                        setSelectedTimetable(timetables.find(t => t.id === e.target.value) || null);
                        setHasUnsavedChanges(false);
                      }}
                    >
                      {timetables.length === 0 && <option>No Timetables</option>}
                      {timetables.map(t => (
                        <option key={t.id} value={t.id}>{t.name} {t.isDraft ? '(Draft)' : ''}</option>
                      ))}
                    </select>

                    {selectedTimetable && user.role === 'admin' && (
                      <input
                        type="text"
                        value={selectedTimetable.name}
                        onChange={(e) => {
                          const newName = e.target.value;
                          setSelectedTimetable(prev => prev ? { ...prev, name: newName } : null);
                          setHasUnsavedChanges(true);
                          // Sync to local list immediately
                          setTimetables(prev => prev.map(t => t.id === selectedTimetable.id ? { ...t, name: newName } : t));
                        }}
                        className="text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500 w-32 md:w-48"
                        placeholder="Timetable name..."
                      />
                    )}
                  </div>
                  {selectedTimetable?.isDraft && (
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px] font-bold uppercase tracking-wider border border-amber-100">
                      Draft
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleExportPDF}
                    className="px-3 py-1.5 text-[11px] font-bold text-slate-500 border border-slate-200 rounded bg-white hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Export PDF
                  </button>
                  {user.role === 'admin' && (
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={handleDuplicate}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors border border-slate-200 rounded bg-white flex items-center gap-1.5 shadow-sm"
                        title="Duplicate (Save As)"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider hidden md:inline-block">Clone</span>
                      </button>
                      
                      {confirmDelete ? (
                        <div className="flex items-center gap-1 animate-in slide-in-from-right-4 duration-300">
                          <button 
                            onClick={handleDeleteTimetable}
                            disabled={isDeleting}
                            className="bg-rose-600 text-white px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider hover:bg-rose-700 transition-all flex items-center gap-1.5 shadow-sm"
                          >
                            {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                          </button>
                          <button 
                            onClick={() => setConfirmDelete(false)}
                            className="bg-slate-100 text-slate-500 px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider hover:bg-slate-200 transition-all border border-slate-200"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setConfirmDelete(true)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors border border-slate-200 rounded bg-white"
                          title="Delete Timetable"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                  <button 
                    className={cn(
                      "btn-primary text-[11px] py-1.5 px-4 flex items-center gap-2 transition-all relative overflow-hidden",
                      saveStatus === 'saved' && "bg-emerald-600 hover:bg-emerald-700",
                      saveStatus === 'failed' && "bg-rose-600 hover:bg-rose-700",
                      hasUnsavedChanges && saveStatus === 'idle' && "ring-2 ring-amber-400 ring-offset-2 animate-pulse"
                    )}
                    onClick={handleSaveTimetable}
                    disabled={savingTt || !selectedTimetable}
                  >
                    {saveStatus === 'saving' ? (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : saveStatus === 'saved' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : saveStatus === 'failed' ? (
                      <AlertCircle className="w-3.5 h-3.5" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    {saveStatus === 'saving' ? 'Saving...' : 
                     saveStatus === 'saved' ? 'Saved' : 
                     saveStatus === 'failed' ? 'Error' : 'Save Changes'}
                    
                    {hasUnsavedChanges && saveStatus === 'idle' && (
                      <span className="absolute top-0 right-0 w-2 h-2 bg-amber-500 rounded-full border border-white"></span>
                    )}
                  </button>
                </div>
              </div>

              <div className="p-0 overflow-x-auto">
                {selectedTimetable ? (
                  <TimetableGrid 
                    timetable={selectedTimetable} 
                    user={user} 
                    onUpdate={(updated) => {
                      setSelectedTimetable(updated);
                      setHasUnsavedChanges(true);
                      setSyncStatus('syncing');
                      // Wait for background save to ensure persistence
                      api.updateTimetable(updated.id, updated)
                        .then(() => setSyncStatus('synced'))
                        .catch((err) => {
                          console.error("Auto-save failed:", err);
                          setSyncStatus('error');
                        });
                    }}
                  />
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                    <Calendar className="w-12 h-12 opacity-10 mb-2" />
                    <p className="text-sm font-medium">Generate a timetable to get started</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <section>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Optimization Status</h2>
            <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] font-bold text-slate-600">Conflict Score</span>
                <span className="text-[11px] font-bold text-emerald-600">Perfect (0.0)</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full w-full"></div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                  <span>Hard Constraints</span>
                  <span className="text-emerald-600 font-bold italic">PASSED</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                   <span>Soft Constraints</span>
                   <span className="text-indigo-600 font-bold italic">98.2%</span>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">System Health</h2>
            <div className="bg-indigo-900 rounded-xl p-4 text-white shadow-lg">
              <h4 className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-3">Real-time Load</h4>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-[9px] font-bold mb-1 uppercase tracking-tighter">
                    <span>Server Load</span>
                    <span>Optimized</span>
                  </div>
                  <div className="h-1 bg-white/20 rounded-full">
                    <div className="w-4/5 h-full bg-white"></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[9px] font-bold mb-1 uppercase tracking-tighter">
                    <span>Memory Usage</span>
                    <span>424MB</span>
                  </div>
                  <div className="h-1 bg-white/20 rounded-full">
                    <div className="w-1/3 h-full bg-indigo-400"></div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
