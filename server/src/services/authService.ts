import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { TJwtPayload, TUserRole } from 'baby-statistic-common';
import { loadOrCreateSecret } from '../utils/secretStore';

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// In production, if no explicit secret is configured via env vars, fall back to a
// secret persisted on disk (generated once, then reused across restarts — see
// utils/secretStore.ts). In development, the fixed fallback secrets are used as-is.
const resolveSecret = (envValue: string | undefined, devFallback: string, fileName: string): string => {
  if (envValue) return envValue;
  if (IS_PRODUCTION) return loadOrCreateSecret(fileName);
  return devFallback;
};

const ACCESS_SECRET = resolveSecret(process.env.JWT_ACCESS_SECRET, 'dev-access-secret-change-in-prod', 'jwt-access.secret');
const REFRESH_SECRET = resolveSecret(process.env.JWT_REFRESH_SECRET, 'dev-refresh-secret-change-in-prod', 'jwt-refresh.secret');
const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY = '7d';



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

