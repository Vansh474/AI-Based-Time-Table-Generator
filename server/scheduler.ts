import { Subject, Teacher, Classroom, Section, DayOfWeek, TimeSlot, TimetableEntry } from '../src/types';

interface Schema {
  subjects: Subject[];
  teachers: Teacher[];
  rooms: Classroom[];
  sections: Section[];
  days: DayOfWeek[];
  slots: TimeSlot[];
}

export class Scheduler {
  private schema: Schema;

  constructor(schema: any) {
    // Ensure we only use valid data rows
    this.schema = {
      ...schema,
      days: schema.days || [],
      slots: schema.slots || [],
      teachers: schema.teachers || [],
      subjects: schema.subjects || [],
      rooms: schema.rooms || [],
      sections: schema.sections || []
    };
  }

  generate(): TimetableEntry[] {
    const { subjects, teachers, rooms, sections, days, slots } = this.schema;
    const availableSlots = slots.filter(s => !s.isBreak);
    const dayIndices = days.map((_, i) => i);
    const slotIndices = availableSlots.map((_, i) => i);
    
    // Pre-calculate slot master indices for fast O(1) consecutive checks
    const slotIdToMasterIdx = new Map<string, number>();
    slots.forEach((s, i) => slotIdToMasterIdx.set(s.id, i));
    
    // Tracking structures for O(1) lookups
    const teacherSlotUsed = new Set<string>(); // "teacherId_dayId_slotId"
    const roomSlotUsed = new Set<string>();    // "roomId_dayId_slotId"
    const sectionSlotUsed = new Set<string>(); // "sectionId_dayId_slotId"
    const teacherDailyCount: Record<string, number> = {}; // "teacherId_dayId" -> count
    
    const entries: TimetableEntry[] = [];
    const requirements: { section: Section, subject: Subject, teacher: Teacher, duration: number }[] = [];

    // Pre-calculate requirements
    sections.forEach(section => {
      subjects.forEach(subject => {
        const teacher = teachers.find(t => t.subjects.includes(subject.id));
        if (teacher) {
          if (subject.type === 'lab') {
            // Labs are scheduled in blocks of 2
            const fullBlocks = Math.floor(subject.weeklyFrequency / 2);
            for (let i = 0; i < fullBlocks; i++) {
              requirements.push({ section, subject, teacher, duration: 2 });
            }
            const remainder = subject.weeklyFrequency % 2;
            if (remainder > 0) {
              requirements.push({ section, subject, teacher, duration: remainder });
            }
          } else {
            for (let i = 0; i < subject.weeklyFrequency; i++) {
              requirements.push({ section, subject, teacher, duration: 1 });
            }
          }
        }
      });
    });

    // Heuristic: Order requirements by difficulty (duration + frequency)
    requirements.sort((a, b) => (b.duration * 10 + b.subject.weeklyFrequency) - (a.duration * 10 + a.subject.weeklyFrequency));

    let iterations = 0;
    const MAX_ITERATIONS = 500000;
    let bestEntries: TimetableEntry[] = [];

    const solve = (index: number): boolean => {
      iterations++;
      
      if (entries.length > bestEntries.length) {
        bestEntries = [...entries];
      }

      if (iterations > MAX_ITERATIONS) return false;
      if (index === requirements.length) return true;

      const { section, subject, teacher, duration } = requirements[index];
      const possibleRooms = rooms.filter(r => r.type === subject.type);
      
      // Shuffle only occasionally or use a more efficient approach
      // For backtracking, a fixed but reasonable order is often enough, 
      // or shuffle once per level depth during search setup
      const shuffledDayIdx = dayIndices.slice().sort(() => Math.random() - 0.5);
      const shuffledSlotIdx = slotIndices.slice().sort(() => Math.random() - 0.5);

      for (const dIdx of shuffledDayIdx) {
        const day = days[dIdx];
        
        for (const sIdx of shuffledSlotIdx) {
          const reqSlots: TimeSlot[] = [];
          
          // Find consecutive slots for the required duration
          let validConsecutive = true;
          for (let d = 0; d < duration; d++) {
            const currentSlotIdx = sIdx + d;
            if (currentSlotIdx >= availableSlots.length) {
              validConsecutive = false;
              break;
            }
            
            const currentSlot = availableSlots[currentSlotIdx];
            if (d > 0) {
              const prevSlot = reqSlots[d - 1];
              const prevMasterIdx = slotIdToMasterIdx.get(prevSlot.id)!;
              const currMasterIdx = slotIdToMasterIdx.get(currentSlot.id)!;
              if (currMasterIdx !== prevMasterIdx + 1) {
                validConsecutive = false;
                break;
              }
            }
            reqSlots.push(currentSlot);
          }

          if (!validConsecutive || reqSlots.length < duration) continue;

          // Check all slots for constraints
          let possible = true;
          const slotKeys: string[] = [];
          const teacherKeys: string[] = [];
          const sectionKeys: string[] = [];
          
          for (const slot of reqSlots) {
            const slotKey = `${day.id}_${slot.id}`;
            const teacherKey = `${teacher.id}_${slotKey}`;
            const sectionKey = `${section.id}_${slotKey}`;
            
            if (teacher.unavailableSlots?.includes(slotKey) || 
                teacherSlotUsed.has(teacherKey) || 
                sectionSlotUsed.has(sectionKey)) {
              possible = false;
              break;
            }
            
            slotKeys.push(slotKey);
            teacherKeys.push(teacherKey);
            sectionKeys.push(sectionKey);
          }
          
          if (!possible) continue;
          
          const teacherDayKey = `${teacher.id}_${day.id}`;
          if ((teacherDailyCount[teacherDayKey] || 0) + duration > (teacher.maxLecturesPerDay || 6)) continue;

          for (const room of possibleRooms) {
            if (room.capacity < section.studentCount) continue;
            
            let roomPossible = true;
            const roomKeys: string[] = [];
            for (const slotKey of slotKeys) {
              const roomKey = `${room.id}_${slotKey}`;
              if (roomSlotUsed.has(roomKey)) {
                roomPossible = false;
                break;
              }
              roomKeys.push(roomKey);
            }
            
            if (!roomPossible) continue;

            // Placement
            const addedEntries: TimetableEntry[] = [];
            reqSlots.forEach(slot => {
              const entry: TimetableEntry = {
                id: Math.random().toString(36).substr(2, 9),
                dayId: day.id,
                slotId: slot.id,
                subjectId: subject.id,
                teacherId: teacher.id,
                roomId: room.id,
                sectionId: section.id
              };
              entries.push(entry);
              addedEntries.push(entry);
            });

            // Commit
            teacherKeys.forEach(k => teacherSlotUsed.add(k));
            sectionKeys.forEach(k => sectionSlotUsed.add(k));
            roomKeys.forEach(k => roomSlotUsed.add(k));
            teacherDailyCount[teacherDayKey] = (teacherDailyCount[teacherDayKey] || 0) + duration;

            if (solve(index + 1)) return true;

            // Backtrack
            for (let i = 0; i < addedEntries.length; i++) {
              entries.pop();
            }
            teacherKeys.forEach(k => teacherSlotUsed.delete(k));
            sectionKeys.forEach(k => sectionSlotUsed.delete(k));
            roomKeys.forEach(k => roomSlotUsed.delete(k));
            teacherDailyCount[teacherDayKey] -= duration;
          }
        }
      }
      return false;
    };

    const solved = solve(0);
    return solved ? entries : bestEntries;
  }

  // Conflict detection for manual edits
  static detectConflicts(entries: TimetableEntry[]): any[] {
    const conflicts: any[] = [];
    const teacherUsed = new Map<string, TimetableEntry>(); // "day_slot_teacher" -> entry
    const roomUsed = new Map<string, TimetableEntry>();    // "day_slot_room"    -> entry
    const sectionUsed = new Map<string, TimetableEntry>(); // "day_slot_section" -> entry
    
    entries.forEach(e => {
      const baseKey = `${e.dayId}_${e.slotId}`;
      const tKey = `${baseKey}_${e.teacherId}`;
      const rKey = `${baseKey}_${e.roomId}`;
      const sKey = `${baseKey}_${e.sectionId}`;

      // Check teacher
      if (teacherUsed.has(tKey)) {
        conflicts.push({ type: 'teacher', entries: [e, teacherUsed.get(tKey)], message: `Teacher double-booked` });
      } else {
        teacherUsed.set(tKey, e);
      }

      // Check room
      if (roomUsed.has(rKey)) {
        conflicts.push({ type: 'room', entries: [e, roomUsed.get(rKey)], message: `Room double-booked` });
      } else {
        roomUsed.set(rKey, e);
      }

      // Check section
      if (sectionUsed.has(sKey)) {
        conflicts.push({ type: 'section', entries: [e, sectionUsed.get(sKey)], message: `Section double-booked` });
      } else {
        sectionUsed.set(sKey, e);
      }
    });
    
    return conflicts;
  }
}
