import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { TJwtPayload, TUserRole } from 'baby-statistic-common';

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12);
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-in-prod';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-in-prod';
const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY = '7d';

if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
    console.warn('[auth] WARNING: JWT_ACCESS_SECRET / JWT_REFRESH_SECRET not set. Using insecure defaults!');
  }
}

export const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, BCRYPT_ROUNDS);

export const comparePassword = (password: string, hash: string): Promise<boolean> =>
  bcrypt.compare(password, hash);

export const signAccessToken = (payload: TJwtPayload): string =>
  jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY });

export const signRefreshToken = (userId: number): string =>
  jwt.sign({ sub: userId }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY });

export const verifyAccessToken = (token: string): TJwtPayload => {
  const decoded = jwt.verify(token, ACCESS_SECRET);
  if (typeof decoded === 'string') throw new Error('Invalid token payload');
  const { sub, username, role, babyId } = decoded as Record<string, unknown>;
  return {
    sub: Number(sub),
    username: String(username),
    role: role as TUserRole,
    babyId: babyId != null ? Number(babyId) : null,
  };
};

export const verifyRefreshToken = (token: string): { sub: number } => {
  const decoded = jwt.verify(token, REFRESH_SECRET);
  if (typeof decoded === 'string') throw new Error('Invalid token payload');
  return { sub: Number((decoded as Record<string, unknown>).sub) };
};

