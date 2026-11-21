import { useEffect, useState } from 'react';
import { Timetable, TimetableEntry, DayOfWeek, TimeSlot, Subject, Teacher, Classroom, Section, User } from '../types';
import { api } from '../lib/api';
import { formatTime, cn } from '../lib/utils';
import { MoreVertical, RotateCcw, AlertTriangle, Users, MapPin, BookOpen, Sparkles } from 'lucide-react';

interface TimetableGridProps {
  timetable: Timetable;
  user: User;
  onUpdate: (tt: Timetable) => void;
}

export default function TimetableGrid({ timetable, user, onUpdate }: TimetableGridProps) {
  const isAdmin = user.role === 'admin';
  const [schema, setSchema] = useState<any>(null);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [viewMode, setViewMode] = useState<'section' | 'teacher'>('section');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');

  useEffect(() => {
    loadSchema();
  }, []);

  useEffect(() => {
    if (timetable.entries.length > 0) {
      checkConflicts();
    }
  }, [timetable.entries]);

  const loadSchema = async () => {
    const data = await api.getSchema();
    setSchema(data);
    
    // Set initial filters based on role
    if (user.role === 'teacher' && user.teacherId) {
      setViewMode('teacher');
      setSelectedTeacher(user.teacherId);
    } else if (user.role === 'student' && user.sectionId) {
      setViewMode('section');
      setSelectedSection(user.sectionId);
    } else {
      if (data.sections.length > 0) setSelectedSection(data.sections[0].id);
      if (data.teachers.length > 0) setSelectedTeacher(data.teachers[0].id);
    }
  };

  const checkConflicts = async () => {
    try {
      const res = await api.resolveConflicts(timetable.entries);
      setConflicts(res.conflicts || []);
    } catch (err) {
      console.error("Conflict checking failed:", err);
      setConflicts([]);
    }
  };

  const [selectedEntry, setSelectedEntry] = useState<TimetableEntry | null>(null);

  if (!schema) return <div className="p-20 text-center h-[500px]">Loading grid schema...</div>;

  const { days, slots, subjects, teachers, rooms, sections } = schema;
  // Previously we filtered out breaks, now we keep them to show in the grid
  const allSlots = slots; 

  // OPTIMIZATION: Pre-map entries once per render for O(1) lookup in cells
  const entryMap = new Map<string, TimetableEntry>();
  timetable.entries.forEach(e => {
    const key = viewMode === 'teacher' 
      ? `${e.dayId}_${e.slotId}_${e.teacherId}`
      : `${e.dayId}_${e.slotId}_${e.sectionId}`;
    entryMap.set(key, e);
  });

  const getEntry = (dayId: string, slotId: string, criteriaId: string) => {
    return entryMap.get(`${dayId}_${slotId}_${criteriaId}`);
  };

  const isConflicted = (entryId: string) => {
    if (!Array.isArray(conflicts)) return false;
    return conflicts.some(c => c.entries?.some((e: any) => e.id === entryId));
  };

  const handleCellClick = (dayId: string, slotId: string) => {
    if (!isAdmin) return;

    const queryId = viewMode === 'section' ? selectedSection : selectedTeacher;
    const currentEntry = getEntry(dayId, slotId, queryId);

    if (selectedEntry) {
      // We are trying to move/swap an entry
      const updatedEntries = timetable.entries.map(e => {
        if (e.id === selectedEntry.id) {
          // Move the selected entry to the target cell
          return { ...e, dayId, slotId };
        }
        if (currentEntry && e.id === currentEntry.id) {
          // If there was an entry in the target cell, swap it to the source cell
          return { ...e, dayId: selectedEntry.dayId, slotId: selectedEntry.slotId };
        }
        return e;
      });

      onUpdate({ ...timetable, entries: updatedEntries });
      setSelectedEntry(null);
    } else if (currentEntry) {
      // Start a move operation
      setSelectedEntry(currentEntry);
    }
  };

  return (
    <div className="flex flex-col bg-white">
      {/* Selection Status Bar */}
      {selectedEntry && (
        <div className="bg-indigo-600 text-white p-3 text-xs font-bold flex justify-between items-center animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span>Moving {subjects.find((s: any) => s.id === selectedEntry.subjectId)?.name}. Click target cell to swap or move.</span>
          </div>
          <button onClick={() => setSelectedEntry(null)} className="px-3 py-1 bg-white/20 rounded-lg hover:bg-white/30 transition-all uppercase tracking-widest text-[10px]">Cancel</button>
        </div>
      )}

      {/* View Mode & Filter Selector */}
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">View Mode:</span>
          <div className="flex bg-white rounded-lg border border-slate-200 p-0.5">
            <button 
              onClick={() => setViewMode('section')}
              className={cn("px-3 py-1 rounded text-[10px] font-bold transition-all", viewMode === 'section' ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400")}
            >Section</button>
            <button 
              onClick={() => setViewMode('teacher')}
              className={cn("px-3 py-1 rounded text-[10px] font-bold transition-all", viewMode === 'teacher' ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400")}
            >Teacher</button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {viewMode === 'section' ? 'Select Section:' : 'Select Teacher:'}
          </span>
          <div className="flex gap-1.5 flex-wrap">
            {viewMode === 'section' ? sections.map((s: Section) => (
              <button
                key={s.id}
                onClick={() => setSelectedSection(s.id)}
                className={cn(
                  "px-3 py-1 rounded text-[10px] font-bold transition-all",
                  selectedSection === s.id 
                    ? "bg-indigo-600/10 text-indigo-700 border border-indigo-200" 
                    : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300"
                )}
              >
                {s.name}
              </button>
            )) : teachers.map((t: Teacher) => (
              <button
                key={t.id}
                onClick={() => setSelectedTeacher(t.id)}
                className={cn(
                  "px-3 py-1 rounded text-[10px] font-bold transition-all",
                  selectedTeacher === t.id 
                    ? "bg-indigo-600/10 text-indigo-700 border border-indigo-200" 
                    : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300"
                )}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="p-3 border-b border-r border-slate-200 min-w-[80px]"></th>
              {allSlots.map((slot: TimeSlot) => (
                <th key={slot.id} className="p-3 border-b border-r border-slate-200 min-w-[140px]">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {slot.name || (slot.isBreak ? 'Break' : 'Lecture')}
                  </div>
                  <div className="text-[10px] font-medium text-slate-400">
                    {slot.startTime}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day: DayOfWeek) => (
              <tr key={day.id} className="group">
                <td className="p-3 border-b border-r border-slate-200 bg-slate-50">
                   <div className="text-[10px] uppercase font-bold text-slate-500 tracking-tight text-center">
                    {day.name.slice(0, 3)}
                  </div>
                </td>
                {allSlots.map((slot: TimeSlot) => {
                  const queryId = viewMode === 'section' ? selectedSection : selectedTeacher;
                  const entry = getEntry(day.id, slot.id, queryId);
                  const subject = entry ? subjects.find((s: Subject) => s.id === entry.subjectId) : null;
                  const teacher = entry ? teachers.find((t: Teacher) => t.id === entry.teacherId) : null;
                  const section = entry ? sections.find((s: Section) => s.id === entry.sectionId) : null;
                  const room = entry ? rooms.find((r: Classroom) => r.id === entry.roomId) : null;
                  const hasConflict = entry ? isConflicted(entry.id) : false;

                  if (slot.isBreak) {
                    return (
                      <td key={slot.id} className="p-2 border-b border-r border-slate-100 h-24 bg-slate-50/50 flex items-center justify-center">
                        <div className="w-full h-full flex items-center justify-center border border-dashed border-slate-200 rounded-lg">
                           <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 transform -rotate-12">Recess</span>
                        </div>
                      </td>
                    );
                  }

                  const colorClasses = subject?.type === 'lab' 
                    ? "bg-emerald-50 border-emerald-500 text-emerald-900"
                    : "bg-indigo-50 border-indigo-500 text-indigo-900";

                  return (
                    <td 
                      key={slot.id} 
                      onClick={() => handleCellClick(day.id, slot.id)}
                      className={cn(
                        "p-2 border-b border-r border-slate-100 h-24 transition-all relative overflow-hidden",
                        isAdmin && "cursor-pointer",
                        hasConflict ? "bg-rose-50" : "bg-white hover:bg-slate-50/50",
                        selectedEntry && "hover:border-indigo-400 border-2"
                      )}
                    >
                      {entry ? (
                        <div className={cn(
                          "h-full p-2 border-l-4 rounded-r-md flex flex-col justify-between transition-all",
                          selectedEntry?.id === entry.id && "scale-95 border-dashed bg-indigo-100 ring-2 ring-indigo-500",
                          !selectedEntry && (hasConflict ? "bg-rose-100/50 border-rose-500 text-rose-900" : colorClasses),
                          selectedEntry && selectedEntry.id !== entry.id && "opacity-50"
                        )}>
                          <div>
                            <p className="text-[11px] font-bold leading-tight truncate">{subject?.name || 'Unknown Subject'}</p>
                            <p className="text-[9px] opacity-70 mt-0.5 truncate">
                              {viewMode === 'section' ? (teacher?.name || 'No Teacher') : (section?.name || 'No Section')}
                            </p>
                          </div>
                          <p className="text-[10px] font-bold mt-auto tracking-tighter opacity-80">{room?.name || 'No Room'}</p>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center bg-slate-50/30">
                          <span className="text-[9px] font-medium text-slate-300 italic">Empty Slot</span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
