/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Role = 'admin' | 'teacher' | 'student';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  teacherId?: string; // If role is teacher, link to teacher record
  sectionId?: string; // If role is student, link to section record
}

export interface DayOfWeek {
  id: string;
  name: string;
}

export interface TimeSlot {
  id: string;
  startTime: string; // e.g., "08:00"
  endTime: string;   // e.g., "09:00"
  isBreak?: boolean;
  name?: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  type: 'theory' | 'lab';
  weeklyFrequency: number;
  credits: number;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  maxLecturesPerDay: number;
  unavailableSlots: string[]; // Array of SLOT_DAY_ID e.g., "slot1_mon"
  subjects: string[]; // Array of subject IDs they can teach
}

export interface Classroom {
  id: string;
  name: string;
  capacity: number;
  type: 'theory' | 'lab';
}

export interface Section {
  id: string;
  name: string; // e.g., "CSE-A"
  studentCount: number;
}

export interface TimetableEntry {
  id: string;
  dayId: string;
  slotId: string;
  subjectId: string;
  teacherId: string;
  roomId: string;
  sectionId: string;
}

export interface Timetable {
  id: string;
  name: string;
  createdAt: string;
  entries: TimetableEntry[];
  isDraft: boolean;
}

export interface GenerationProgress {
  status: 'idle' | 'generating' | 'completed' | 'failed';
  progress: number;
  message: string;
  conflicts?: number;
}
