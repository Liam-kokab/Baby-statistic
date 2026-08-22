import type { TApiKey, TApiKeyDb } from 'baby-statistic-common';
import { db } from '../db';
import { nowOslo, toOsloIso } from '../utils/time';

const fromDb = (row: TApiKeyDb): TApiKey => ({
  id: row.id,
  name: row.name,
  createdBy: row.created_by,
  createdAt: toOsloIso(row.created_at),
});

export const apiKeyRepository = {
  findAll: (): TApiKey[] =>
    db.prepare<[], TApiKeyDb>('SELECT * FROM api_keys ORDER BY created_at DESC').all().map(fromDb),

  /** Fast, indexed lookup by the SHA-256 hash of a presented key — used by the
   * `authenticate` middleware fallback, never by client-facing routes. */
  findByHash: (keyHash: string): TApiKeyDb | null =>
    db.prepare<[string], TApiKeyDb>('SELECT * FROM api_keys WHERE key_hash = ?').get(keyHash) ?? null,

  insert: (data: { name: string; keyHash: string; createdBy: number }): TApiKey => {
    const now = nowOslo();
    const result = db.prepare<{ name: string; key_hash: string; created_by: number; created_at: string }>(
      'INSERT INTO api_keys (name, key_hash, created_by, created_at) VALUES (@name, @key_hash, @created_by, @created_at)'
    ).run({ name: data.name, key_hash: data.keyHash, created_by: data.createdBy, created_at: now });
    const row = db.prepare<[number], TApiKeyDb>('SELECT * FROM api_keys WHERE id = ?').get(result.lastInsertRowid as number);
    return fromDb(row!);
  },

  delete: (id: number): boolean => {
    const result = db.prepare<[number]>('DELETE FROM api_keys WHERE id = ?').run(id);
    return result.changes > 0;
  },
};

