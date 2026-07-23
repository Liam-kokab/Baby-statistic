import type { TPee, TPeeDb } from 'baby-statistic-common';
import { db } from '../db';
import type { TTimeFilter } from '../types';
import { nowOslo, toOsloIso, toOsloLocal } from '../utils/time';

const fromDb = (row: TPeeDb): TPee => ({
  id: row.id,
  createdAt: toOsloIso(row.created_at),
});

export const peeRepository = {
  findAll: (filter: TTimeFilter = {}, babyId: number): TPee[] => {
    const conditions = ['baby_id = ?', ...(filter.from ? ['created_at >= ?'] : []), ...(filter.to ? ['created_at <= ?'] : [])];
    const params = [babyId, ...(filter.from ? [filter.from] : []), ...(filter.to ? [filter.to] : [])];
    const rows = db.prepare<unknown[], TPeeDb>(`SELECT * FROM pee WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`).all(...params);
    return rows.map(fromDb);
  },

  findById: (id: number, babyId: number): TPee | null => {
    const row = db.prepare<[number, number], TPeeDb>('SELECT * FROM pee WHERE id = ? AND baby_id = ?').get(id, babyId);
    return row ? fromDb(row) : null;
  },

  insert: (babyId: number, createdBy: number): TPee => {
    const now = nowOslo();
    const result = db.prepare<[string, number, number]>('INSERT INTO pee (created_at, baby_id, created_by) VALUES (?, ?, ?)').run(now, babyId, createdBy);
    const row = db.prepare<[number], TPeeDb>('SELECT * FROM pee WHERE rowid = ?').get(result.lastInsertRowid as number);
    return fromDb(row!);
  },

  update: (id: number, data: { createdAt?: string }, babyId: number): TPee | null => {
    if (data.createdAt) {
      db.prepare<[string, number, number]>('UPDATE pee SET created_at = ? WHERE id = ? AND baby_id = ?')
        .run(toOsloLocal(data.createdAt), id, babyId);
    }
    const updated = db.prepare<[number], TPeeDb>('SELECT * FROM pee WHERE id = ?').get(id);
    return updated ? fromDb(updated) : null;
  },

  delete: (id: number, babyId: number): boolean => {
    const result = db.prepare<[number, number]>('DELETE FROM pee WHERE id = ? AND baby_id = ?').run(id, babyId);
    return result.changes > 0;
  },

  getBackup: (from: string, to: string, babyId: number): TPee[] => {
    const rows = db.prepare<[string, string, number], TPeeDb>(
      'SELECT * FROM pee WHERE created_at >= ? AND created_at <= ? AND baby_id = ?'
    ).all(from, to, babyId);
    return rows.map(fromDb);
  },
};
