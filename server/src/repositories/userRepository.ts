import type { TUser, TUserDb, TUserConfig, TUserRole } from 'baby-statistic-common';
import { db } from '../db';
import { nowOslo, toOsloIso } from '../utils/time';

const fromDb = (row: TUserDb): TUser => ({
  id: row.id,
  username: row.username,
  name: row.name ?? '',
  role: row.role,
  babyId: row.baby_id,
  config: JSON.parse(row.config ?? '{}') as TUserConfig,
  createdAt: toOsloIso(row.created_at),
});

export const userRepository = {
  findById: (id: number): TUserDb | null =>
    db.prepare<[number], TUserDb>('SELECT * FROM users WHERE id = ?').get(id) ?? null,

  findByUsername: (username: string): TUserDb | null =>
    db.prepare<[string], TUserDb>('SELECT * FROM users WHERE username = ?').get(username) ?? null,

  findAll: (): TUser[] =>
    db.prepare<[], TUserDb>('SELECT * FROM users ORDER BY username').all().map(fromDb),

  findByBaby: (babyId: number): TUser[] =>
    db.prepare<[number], TUserDb>('SELECT * FROM users WHERE baby_id = ? ORDER BY username').all(babyId).map(fromDb),

  insert: (data: { username: string; role: TUserRole; babyId?: number | null; passwordHash: string; name?: string }): TUser => {
    const now = nowOslo();
    const result = db.prepare<{
      username: string; password_hash: string; role: string;
      baby_id: number | null; name: string; created_at: string;
    }>(
      'INSERT INTO users (username, password_hash, role, baby_id, name, created_at) VALUES (@username, @password_hash, @role, @baby_id, @name, @created_at)'
    ).run({
      username: data.username,
      password_hash: data.passwordHash,
      role: data.role,
      baby_id: data.babyId ?? null,
      name: data.name ?? '',
      created_at: now,
    });
    const row = db.prepare<[number], TUserDb>('SELECT * FROM users WHERE rowid = ?').get(result.lastInsertRowid as number);
    return fromDb(row!);
  },

  update: (id: number, patch: { passwordHash?: string; babyId?: number | null; config?: string; name?: string }): TUser | null => {
    const existing = db.prepare<[number], TUserDb>('SELECT * FROM users WHERE id = ?').get(id);
    if (!existing) return null;
    const passwordHash = patch.passwordHash ?? existing.password_hash;
    const babyId = patch.babyId !== undefined ? patch.babyId : existing.baby_id;
    const config = patch.config ?? existing.config;
    const name = patch.name !== undefined ? patch.name : (existing.name ?? '');
    db.prepare<{ id: number; password_hash: string; baby_id: number | null; config: string; name: string }>(
      'UPDATE users SET password_hash = @password_hash, baby_id = @baby_id, config = @config, name = @name WHERE id = @id'
    ).run({ id, password_hash: passwordHash, baby_id: babyId, config, name });
    const row = db.prepare<[number], TUserDb>('SELECT * FROM users WHERE id = ?').get(id);
    return row ? fromDb(row) : null;
  },

  delete: (id: number): boolean => {
    const result = db.prepare<[number]>('DELETE FROM users WHERE id = ?').run(id);
    return result.changes > 0;
  },

  addBabyUser: (userId: number, babyId: number): void => {
    db.prepare<[number, number]>(
      'INSERT OR IGNORE INTO baby_users (user_id, baby_id) VALUES (?, ?)'
    ).run(userId, babyId);
  },

  removeBabyUser: (userId: number, babyId: number): void => {
    db.prepare<[number, number]>(
      'DELETE FROM baby_users WHERE user_id = ? AND baby_id = ?'
    ).run(userId, babyId);
  },

  adminExists: (): boolean => {
    const row = db.prepare<[string], { count: number }>('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin');
    return (row?.count ?? 0) > 0;
  },

  insertAdmin: (username: string, passwordHash: string): void => {
    const now = nowOslo();
    db.prepare<{ username: string; password_hash: string; created_at: string }>(
      "INSERT INTO users (username, password_hash, role, baby_id, name, created_at) VALUES (@username, @password_hash, 'admin', NULL, '', @created_at)"
    ).run({ username, password_hash: passwordHash, created_at: now });
  },

  saveRefreshToken: (userId: number, tokenHash: string, expiresAt: string): void => {
    const now = nowOslo();
    db.prepare<{ user_id: number; token_hash: string; expires_at: string; created_at: string }>(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at) VALUES (@user_id, @token_hash, @expires_at, @created_at)'
    ).run({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt, created_at: now });
  },

  findRefreshToken: (tokenHash: string): { user_id: number; expires_at: string } | null =>
    db.prepare<[string], { user_id: number; expires_at: string }>(
      'SELECT user_id, expires_at FROM refresh_tokens WHERE token_hash = ?'
    ).get(tokenHash) ?? null,

  deleteRefreshToken: (tokenHash: string): void => {
    db.prepare<[string]>('DELETE FROM refresh_tokens WHERE token_hash = ?').run(tokenHash);
  },

  deleteExpiredRefreshTokens: (userId: number): void => {
    db.prepare<[number, string]>(
      'DELETE FROM refresh_tokens WHERE user_id = ? AND expires_at < ?'
    ).run(userId, nowOslo());
  },

  deleteAllRefreshTokensForUser: (userId: number): void => {
    db.prepare<[number]>('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
  },

  toPublic: (row: TUserDb): TUser => fromDb(row),
};

