import type { TApiKey, TApiKeyDb } from 'baby-statistic-common';
import { db } from '../db';
import { nowOslo, toOsloIso } from '../utils/time';

const fromDb = (row: TApiKeyDb): TApiKey => ({
  id: row.id,
  name: row.name,
  createdBy: row.created_by,
  createdAt: toOsloIso(row.created_at),
  babyId: row.baby_id,
});

export const apiKeyRepository = {
  findAll: (): TApiKey[] =>
    db.prepare<[], TApiKeyDb>('SELECT * FROM api_keys ORDER BY created_at DESC').all().map(fromDb),

  /** Baby-scoped keys only (baby_id = the given id) — used by the baby-owner-facing routes
   * so a regular user can only ever see/manage keys for their own baby. */
  findAllByBaby: (babyId: number): TApiKey[] =>
    db.prepare<[number], TApiKeyDb>('SELECT * FROM api_keys WHERE baby_id = ? ORDER BY created_at DESC')
      .all(babyId).map(fromDb),

  /** Fast, indexed lookup by the SHA-256 hash of a presented key — used by the
   * `authenticate` middleware fallback, never by client-facing routes. */
  findByHash: (keyHash: string): TApiKeyDb | null =>
    db.prepare<[string], TApiKeyDb>('SELECT * FROM api_keys WHERE key_hash = ?').get(keyHash) ?? null,

  insert: (data: { name: string; keyHash: string; createdBy: number; babyId: number | null }): TApiKey => {
    const now = nowOslo();
    const result = db.prepare<{ name: string; key_hash: string; created_by: number; created_at: string; baby_id: number | null }>(
      'INSERT INTO api_keys (name, key_hash, created_by, created_at, baby_id) VALUES (@name, @key_hash, @created_by, @created_at, @baby_id)'
    ).run({ name: data.name, key_hash: data.keyHash, created_by: data.createdBy, created_at: now, baby_id: data.babyId });
    const row = db.prepare<[number], TApiKeyDb>('SELECT * FROM api_keys WHERE id = ?').get(result.lastInsertRowid as number);
    return fromDb(row!);
  },

  delete: (id: number): boolean => {
    const result = db.prepare<[number]>('DELETE FROM api_keys WHERE id = ?').run(id);
    return result.changes > 0;
  },

  /** Deletes only if the key belongs to the given baby — prevents a user from deleting
   * another baby's (or an admin-scoped) key by guessing an id. */
  deleteForBaby: (id: number, babyId: number): boolean => {
    const result = db.prepare<[number, number]>('DELETE FROM api_keys WHERE id = ? AND baby_id = ?').run(id, babyId);
    return result.changes > 0;
  },
};
