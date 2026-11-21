import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import {
  DUMMY_PASSWORD_HASH,
  validatePasswordStrength,
  hashPassword,
  comparePassword,
} from './password.js';

function resolveJwtSecret(): string {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured) {
    if (configured.length < 32) {
      console.warn(
        '[Auth] Warning: JWT_SECRET is shorter than 32 characters. Use at least 32 random characters in production.'
      );
    }
    return configured;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: JWT_SECRET environment variable is required in production. Configure JWT_SECRET in your environment before starting the server.'
    );
  }

  console.warn(
    '[Auth] Warning: JWT_SECRET is not set in development. Using an ephemeral in-memory random signing key for this dev process; set JWT_SECRET in .env or your environment for persistent sessions.'
  );
  return crypto.randomBytes(32).toString('hex');
}

const JWT_SECRET = resolveJwtSecret();

export { DUMMY_PASSWORD_HASH, validatePasswordStrength, hashPassword, comparePassword };

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  teacherId?: string;
  sectionId?: string;
}

export function sanitizeUser(user: any): SafeUser {
  const safe: SafeUser = {
    id: String(user.id),
    name: String(user.name),
    email: String(user.email),
    role: user.role,
  };
  if (user.teacherId) safe.teacherId = String(user.teacherId);
  if (user.sectionId) safe.sectionId = String(user.sectionId);
  return safe;
}

export function generateToken(user: any): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '24h' }
  );
}

export function verifyToken(token: string): any | null {
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}
