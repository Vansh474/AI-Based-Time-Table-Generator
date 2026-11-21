import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { getData, updateData } from './db.js';
import {
  generateToken,
  verifyToken,
  hashPassword,
  comparePassword,
  sanitizeUser,
  validatePasswordStrength,
  DUMMY_PASSWORD_HASH,
} from './auth.js';
import { Scheduler } from './scheduler.js';

const router = express.Router();

const ALLOWED_SETTINGS_KEYS = new Set([
  'subjects',
  'teachers',
  'rooms',
  'sections',
  'days',
  'slots',
  'timetables',
]);

// In-memory login attempt limiter to mitigate brute-force password guessing
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 15;
const failedLoginAttempts = new Map<string, { count: number; resetAt: number }>();

function getAttemptKey(req: express.Request): string {
  return req.ip || 'unknown';
}

function isRateLimited(key: string): boolean {
  const entry = failedLoginAttempts.get(key);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    failedLoginAttempts.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILED_ATTEMPTS;
}

function recordFailedAttempt(key: string): void {
  const now = Date.now();
  const entry = failedLoginAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    failedLoginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

function clearFailedAttempts(key: string): void {
  failedLoginAttempts.delete(key);
}

// Middleware to check auth
const authMiddleware = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const decoded = verifyToken(token);
  if (!decoded || !decoded.id) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  const data = getData();
  const user = Array.isArray(data.users)
    ? data.users.find((u: any) => u.id === decoded.id)
    : null;

  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  req.user = sanitizeUser(user);
  next();
};

const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};

// Public endpoint returning only whether initial admin password setup is pending
router.get('/auth/setup-status', (req, res) => {
  const data = getData();
  const users = Array.isArray(data.users) ? data.users : [];
  const hasConfiguredAdmin = users.some(
    (u: any) => u.role === 'admin' && typeof u.passwordHash === 'string' && u.passwordHash.length > 0
  );
  res.json({ needsInitialAdminSetup: !hasConfiguredAdmin });
});

// One-time initial admin password setup (automatically locked once any admin has a passwordHash)
router.post('/auth/setup-admin', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ message: 'Administrator email is required' });
  }

  const strength = validatePasswordStrength(password);
  if (!strength.valid) {
    return res.status(400).json({ message: strength.message });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const initialData = getData();
  const initialUsers = Array.isArray(initialData.users) ? initialData.users : [];
  const alreadyHasAdmin = initialUsers.some(
    (u: any) => u.role === 'admin' && typeof u.passwordHash === 'string' && u.passwordHash.length > 0
  );
  if (alreadyHasAdmin) {
    return res.status(403).json({ message: 'Initial admin setup has already been completed' });
  }

  const passwordHash = await hashPassword(password);

  const result: {
    status: 'ok' | 'already_configured' | 'not_found';
    updatedAdmin: any;
  } = { status: 'not_found', updatedAdmin: null };

  updateData((data) => {
    const users = Array.isArray(data.users) ? data.users : [];
    const hasConfiguredAdmin = users.some(
      (u: any) => u.role === 'admin' && typeof u.passwordHash === 'string' && u.passwordHash.length > 0
    );
    if (hasConfiguredAdmin) {
      result.status = 'already_configured';
      return data;
    }

    const adminIndex = users.findIndex(
      (u: any) => u.role === 'admin' && typeof u.email === 'string' && u.email.trim().toLowerCase() === normalizedEmail
    );
    if (adminIndex === -1) {
      result.status = 'not_found';
      return data;
    }

    const updatedUser = {
      ...users[adminIndex],
      passwordHash,
      passwordUpdatedAt: new Date().toISOString(),
    };
    const nextUsers = [...users];
    nextUsers[adminIndex] = updatedUser;
    result.updatedAdmin = updatedUser;
    result.status = 'ok';
    return { ...data, users: nextUsers };
  });

  if (result.status === 'already_configured') {
    return res.status(403).json({ message: 'Initial admin setup has already been completed' });
  }
  if (result.status !== 'ok' || !result.updatedAdmin) {
    return res.status(400).json({ message: 'Matching administrator account not found' });
  }

  const token = generateToken(result.updatedAdmin);
  res.json({ user: sanitizeUser(result.updatedAdmin), token });
});

// Auth Routes
router.post('/login', async (req, res) => {
  const attemptKey = getAttemptKey(req);
  if (isRateLimited(attemptKey)) {
    return res.status(429).json({ message: 'Too many login attempts. Please try again later.' });
  }

  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const data = getData();
  const users = Array.isArray(data.users) ? data.users : [];
  const user = users.find(
    (u: any) => typeof u.email === 'string' && u.email.trim().toLowerCase() === normalizedEmail
  );

  if (!user || typeof user.passwordHash !== 'string' || !user.passwordHash) {
    await comparePassword(password, DUMMY_PASSWORD_HASH);
    recordFailedAttempt(attemptKey);
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const isPasswordValid = await comparePassword(password, user.passwordHash);
  if (!isPasswordValid) {
    recordFailedAttempt(attemptKey);
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  clearFailedAttempts(attemptKey);
  const token = generateToken(user);
  res.json({ user: sanitizeUser(user), token });
});

router.get('/auth/me', authMiddleware, (req: any, res) => {
  res.json({ user: req.user });
});

router.post('/auth/change-password', authMiddleware, async (req: any, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (typeof currentPassword !== 'string' || !currentPassword) {
    return res.status(400).json({ message: 'Current password is required' });
  }

  const strength = validatePasswordStrength(newPassword);
  if (!strength.valid) {
    return res.status(400).json({ message: strength.message });
  }

  const data = getData();
  const existingUser = (data.users || []).find((u: any) => u.id === req.user.id);
  if (!existingUser || typeof existingUser.passwordHash !== 'string' || !existingUser.passwordHash) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const matches = await comparePassword(currentPassword, existingUser.passwordHash);
  if (!matches) {
    return res.status(401).json({ message: 'Current password is incorrect' });
  }

  const newHash = await hashPassword(newPassword);
  updateData((latest) => {
    const users = Array.isArray(latest.users) ? latest.users : [];
    const nextUsers = users.map((u: any) =>
      u.id === req.user.id
        ? { ...u, passwordHash: newHash, passwordUpdatedAt: new Date().toISOString() }
        : u
    );
    return { ...latest, users: nextUsers };
  });

  res.json({ message: 'Password updated successfully' });
});

// Admin User Access Management (never exposes password hashes)
router.get('/users', authMiddleware, requireAdmin, (req, res) => {
  const data = getData();
  const users = Array.isArray(data.users) ? data.users : [];
  res.json(
    users.map((u: any) => ({
      ...sanitizeUser(u),
      hasPassword: typeof u.passwordHash === 'string' && u.passwordHash.length > 0,
    }))
  );
});

router.post('/users/:id/password', authMiddleware, requireAdmin, async (req, res) => {
  const { password } = req.body ?? {};
  const strength = validatePasswordStrength(password);
  if (!strength.valid) {
    return res.status(400).json({ message: strength.message });
  }

  const passwordHash = await hashPassword(password);
  let updatedUser: any = null;

  updateData((data) => {
    const users = Array.isArray(data.users) ? data.users : [];
    const index = users.findIndex((u: any) => u.id === req.params.id);
    if (index === -1) return data;

    const nextUser = {
      ...users[index],
      passwordHash,
      passwordUpdatedAt: new Date().toISOString(),
    };
    const nextUsers = [...users];
    nextUsers[index] = nextUser;
    updatedUser = nextUser;
    return { ...data, users: nextUsers };
  });

  if (!updatedUser) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json({
    message: 'User password configured successfully',
    user: { ...sanitizeUser(updatedUser), hasPassword: true },
  });
});

// Settings / Schema Routes (never expose users or password hashes)
router.get('/schema', authMiddleware, (req, res) => {
  const data = getData();
  const { timetables, users, ...config } = data;
  res.json(config);
});

router.post('/save-settings', authMiddleware, requireAdmin, (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ message: 'Invalid settings payload' });
  }

  const filteredUpdate: Record<string, any> = {};
  for (const key of Object.keys(req.body)) {
    if (!ALLOWED_SETTINGS_KEYS.has(key)) {
      return res.status(400).json({ message: `Unsupported settings field: ${key}` });
    }
    if (!Array.isArray(req.body[key])) {
      return res.status(400).json({ message: `Field '${key}' must be an array` });
    }
    filteredUpdate[key] = req.body[key];
  }

  const updatedData = updateData((data) => ({
    ...data,
    ...filteredUpdate,
  }));

  const { users, ...safeData } = updatedData;
  res.json({ message: 'Settings saved', data: safeData });
});

// Generation Routes
router.post('/generate', authMiddleware, requireAdmin, (req, res) => {
  let newTimetable: any = null;

  updateData((data) => {
    const scheduler = new Scheduler(data);
    const entries = scheduler.generate();

    newTimetable = {
      id: `tt_${Date.now()}`,
      name: `Timetable ${data.timetables.length + 1}`,
      createdAt: new Date().toISOString(),
      entries,
      isDraft: true,
    };

    data.timetables.push(newTimetable);
    return data;
  });

  res.json(newTimetable);
});

router.post('/resolve-conflicts', authMiddleware, (req, res) => {
  const entries = req.body?.entries;
  if (!Array.isArray(entries)) {
    return res.status(400).json({ message: 'entries array is required' });
  }
  const conflicts = Scheduler.detectConflicts(entries);
  res.json({ conflicts });
});

// Server-side Gemini Chat Proxy (keeps GEMINI_API_KEY strictly on the server)
router.post('/chat', authMiddleware, async (req: any, res) => {
  const rawMessage = req.body?.message ?? req.body?.prompt;
  if (typeof rawMessage !== 'string' || !rawMessage.trim()) {
    return res.status(400).json({ message: 'Message is required' });
  }
  const message = rawMessage.trim().slice(0, 2000);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return res.status(503).json({ message: 'AI assistant is not configured on the server.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: message,
      config: {
        systemInstruction: `You are the "Scheduling Orchestrator". You have full control over the college timetable system.
If the user asks to generate a timetable, you must use the keyword [ACTION_GENERATE] in your response.
If the user asks to add a subject, summarize the information and use [ACTION_ADD_SUBJECT].
Current User: ${req.user.name} (${req.user.role}). Only allow admin actions if role is admin.
Always be professional and decisive.`,
      },
    });
    res.json({ text: response.text || "I'm not sure how to respond." });
  } catch (err: any) {
    console.error('[AI Chat] Generation error:', err?.message || 'Unknown error');
    res.status(500).json({ message: 'Failed to process AI request' });
  }
});

// Timetable Routes
router.get('/timetables', authMiddleware, (req, res) => {
  const data = getData();
  res.json(data.timetables);
});

router.put('/timetables/:id', authMiddleware, requireAdmin, (req, res) => {
  const { name, entries, isDraft } = req.body ?? {};
  const patch: Record<string, any> = {};
  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Timetable name must be a non-empty string' });
    }
    patch.name = name;
  }
  if (entries !== undefined) {
    if (!Array.isArray(entries)) {
      return res.status(400).json({ message: 'Timetable entries must be an array' });
    }
    patch.entries = entries;
  }
  if (isDraft !== undefined) {
    if (typeof isDraft !== 'boolean') {
      return res.status(400).json({ message: 'isDraft must be a boolean' });
    }
    patch.isDraft = isDraft;
  }

  let updatedTimetable: any = null;
  let found = false;

  updateData((data) => {
    const index = data.timetables.findIndex((t: any) => t.id === req.params.id);
    if (index !== -1) {
      data.timetables[index] = { ...data.timetables[index], ...patch };
      updatedTimetable = data.timetables[index];
      found = true;
    }
    return data;
  });

  if (found) {
    res.json(updatedTimetable);
  } else {
    res.status(404).json({ message: 'Not found' });
  }
});

router.delete('/timetables/:id', authMiddleware, requireAdmin, (req, res) => {
  let deleted = false;

  updateData((data) => {
    const initialLength = data.timetables.length;
    data.timetables = data.timetables.filter((t: any) => t.id !== req.params.id);
    if (data.timetables.length < initialLength) {
      deleted = true;
    }
    return data;
  });

  if (deleted) {
    res.json({ message: 'Timetable deleted successfully' });
  } else {
    res.status(404).json({ message: 'Timetable not found' });
  }
});

export default router;
