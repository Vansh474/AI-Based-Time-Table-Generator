import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

// Pre-computed random hash used to keep login timing uniform when an account does not exist or has no password set.
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10);

export function validatePasswordStrength(password: unknown): { valid: boolean; message?: string } {
  if (typeof password !== 'string') {
    return { valid: false, message: 'Password must be a string' };
  }
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (Buffer.byteLength(password, 'utf8') > 72) {
    return { valid: false, message: 'Password must not exceed 72 bytes' };
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one letter and one number' };
  }
  return { valid: true };
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}
