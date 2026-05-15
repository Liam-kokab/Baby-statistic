import type { TPumping, TPumpingDb } from 'baby-statistic-common';
import { db } from '../db';
import type { TTimeFilter } from '../types';
import { nowOslo, toOsloIso, toOsloLocal } from '../utils/time';

const fromDb = (row: TPumpingDb): TPumping => ({
  id: row.id,
  createdAt: toOsloIso(row.created_at),
});

export const pumpingRepository = {
  findAll: (filter: TTimeFilter = {}): TPumping[] => {
    const conditions = [
      ...(filter.from ? ['created_at >= ?'] : []),
      ...(filter.to ? ['created_at <= ?'] : []),
    ];
    const params = [
      ...(filter.from ? [filter.from] : []),
      ...(filter.to ? [filter.to] : []),
    ];
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare<string[], TPumpingDb>(`SELECT * FROM pumping ${where} ORDER BY created_at DESC`).all(...params);
    return rows.map(fromDb);
  },

  findLatest: (): TPumping | null => {
    const row = db.prepare<[], TPumpingDb>('SELECT * FROM pumping ORDER BY created_at DESC LIMIT 1').get();
    return row ? fromDb(row) : null;
  },

  findById: (id: number): TPumping | null => {
    const row = db.prepare<[number], TPumpingDb>('SELECT * FROM pumping WHERE id = ?').get(id);
    return row ? fromDb(row) : null;
  },

  insert: (): TPumping => {
    const now = nowOslo();
    const result = db.prepare<[string]>('INSERT INTO pumping (created_at) VALUES (?)').run(now);
    const row = db.prepare<[number], TPumpingDb>('SELECT * FROM pumping WHERE rowid = ?').get(result.lastInsertRowid as number);
    return fromDb(row!);
  },

  update: (id: number, data: { createdAt?: string }): TPumping | null => {
    if (data.createdAt) {
      db.prepare<[string, number]>('UPDATE pumping SET created_at = ? WHERE id = ?')
        .run(toOsloLocal(data.createdAt), id);
    }
    const updated = db.prepare<[number], TPumpingDb>('SELECT * FROM pumping WHERE id = ?').get(id);
    return updated ? fromDb(updated) : null;
  },

  delete: (id: number): boolean => {
    const result = db.prepare<[number]>('DELETE FROM pumping WHERE id = ?').run(id);
    return result.changes > 0;
  },
};
