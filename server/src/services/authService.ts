import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { TJwtPayload, TUserRole } from 'baby-statistic-common';

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12);
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-in-prod';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-in-prod';
const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY = '7d';

// JWT secrets come from a .env file (see .env.example, loaded by server/src/loadEnv.ts).
// In production, warn loudly if they were never set — the app still runs, but on
// insecure hardcoded defaults, and restarting the process won't rotate anything.
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
    console.warn('[auth] WARNING: JWT_ACCESS_SECRET / JWT_REFRESH_SECRET not set. Create a .env file at the repo root (see .env.example) with long random values. Using insecure defaults!');
  }
}


export const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, BCRYPT_ROUNDS);

export const comparePassword = (password: string, hash: string): Promise<boolean> =>
  bcrypt.compare(password, hash);

export const signAccessToken = (payload: TJwtPayload): string =>
  jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY });

export const signRefreshToken = (userId: number, authTime: number): string =>
  jwt.sign({ sub: userId, authTime }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY });

export const verifyAccessToken = (token: string): TJwtPayload => {
  const decoded = jwt.verify(token, ACCESS_SECRET);
  if (typeof decoded === 'string') throw new Error('Invalid token payload');
  const { sub, username, role, babyId, authTime } = decoded as Record<string, unknown>;
  return {
    sub: Number(sub),
    username: String(username),
    role: role as TUserRole,
    babyId: babyId != null ? Number(babyId) : null,
    authTime: Number(authTime),
  };
};

export const verifyRefreshToken = (token: string): { sub: number; authTime: number } => {
  const decoded = jwt.verify(token, REFRESH_SECRET);
  if (typeof decoded === 'string') throw new Error('Invalid token payload');
  const { sub, authTime } = decoded as Record<string, unknown>;
  return { sub: Number(sub), authTime: Number(authTime) };
};

