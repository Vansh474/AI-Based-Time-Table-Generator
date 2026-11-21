import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.resolve(__dirname, '../db.json');

let cachedData: any = null;

export function getData() {
  if (cachedData) return cachedData;

  try {
    if (!fs.existsSync(DB_FILE)) {
      console.log(`[Database] DB_FILE not found at ${DB_FILE}. Initializing with defaults.`);
      const initialData = {
        users: [
          { id: '1', name: 'Admin User', email: 'admin@college.edu', role: 'admin' },
          { id: '2', name: 'John Doe', email: 'john@college.edu', role: 'teacher', teacherId: 't1' },
          { id: '3', name: 'Student Use', email: 'student@college.edu', role: 'student', sectionId: 'c1' }
        ],
        subjects: [
          { id: 's1', name: 'Data Structures', code: 'CS101', type: 'theory', weeklyFrequency: 3, credits: 4 },
          { id: 's2', name: 'Algorithms', code: 'CS102', type: 'theory', weeklyFrequency: 3, credits: 4 },
          { id: 's3', name: 'Operating Systems', code: 'CS103', type: 'theory', weeklyFrequency: 3, credits: 4 },
          { id: 's4', name: 'Database Systems', code: 'CS104', type: 'theory', weeklyFrequency: 3, credits: 4 },
          { id: 's5', name: 'Computer Networks', code: 'CS105', type: 'theory', weeklyFrequency: 3, credits: 4 },
          { id: 's6', name: 'Web Dev Lab', code: 'CS106', type: 'lab', weeklyFrequency: 1, credits: 2 }
        ],
        teachers: [
          { id: 't1', name: 'Dr. Smith', email: 'smith@college.edu', maxLecturesPerDay: 4, unavailableSlots: [], subjects: ['s1', 's2'] },
          { id: 't2', name: 'Prof. Jones', email: 'jones@college.edu', maxLecturesPerDay: 4, unavailableSlots: [], subjects: ['s3', 's4'] },
          { id: 't3', name: 'Dr. Brown', email: 'brown@college.edu', maxLecturesPerDay: 4, unavailableSlots: [], subjects: ['s5', 's6'] }
        ],
        rooms: [
          { id: 'r1', name: 'Room 101', capacity: 60, type: 'theory' },
          { id: 'r2', name: 'Room 102', capacity: 60, type: 'theory' },
          { id: 'r3', name: 'Lab 1', capacity: 30, type: 'lab' }
        ],
        sections: [
          { id: 'c1', name: 'CSE-A', studentCount: 50 },
          { id: 'c2', name: 'CSE-B', studentCount: 45 }
        ],
        days: [
          { id: 'mon', name: 'Monday' },
          { id: 'tue', name: 'Tuesday' },
          { id: 'wed', name: 'Wednesday' },
          { id: 'thu', name: 'Thursday' },
          { id: 'fri', name: 'Friday' }
        ],
        slots: [
          { id: 'sl1', startTime: '09:00', endTime: '10:00' },
          { id: 'sl2', startTime: '10:00', endTime: '11:00' },
          { id: 'sl3', startTime: '11:00', endTime: '12:00' },
          { id: 'sl4', startTime: '12:00', endTime: '13:00', isBreak: true },
          { id: 'sl5', startTime: '13:00', endTime: '14:00' },
          { id: 'sl6', startTime: '14:00', endTime: '15:00' }
        ],
        timetables: []
      };
      saveData(initialData);
      return initialData;
    }
  
    cachedData = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    return cachedData;
  } catch (err) {
    console.error("[Database] Load error:", err);
    return { users: [], subjects: [], teachers: [], rooms: [], sections: [], days: [], slots: [], timetables: [] };
  }
}

export function saveData(data: any) {
  try {
    // Log change summary to help debug "removed" items
    if (cachedData) {
      Object.keys(data).forEach(key => {
        if (Array.isArray(data[key]) && Array.isArray(cachedData[key])) {
          if (data[key].length < cachedData[key].length) {
            console.warn(`[Database] WARN: Collection '${key}' shrank from ${cachedData[key].length} to ${data[key].length} items!`);
          }
        }
      });
    }
    
    cachedData = data;
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    console.log(`[Database] Saved ${DB_FILE}. Totals: ${Object.keys(data).map(k => `${k}:${Array.isArray(data[k]) ? data[k].length : 'obj'}`).join(', ')}`);
  } catch (err) {
    console.error(`[Database] Error saving data:`, err);
    throw err;
  }
}

/**
 * Perform an atomic update on the database to prevent race conditions
 */
export function updateData(updater: (data: any) => any) {
  const currentData = getData();
  const newData = updater(currentData);
  saveData(newData);
  return newData;
}
