import type { TPoop, TPoopDb } from 'baby-statistic-common';
import { db } from '../db';
import type { TTimeFilter } from '../types';
import { nowOslo, toOsloIso, toOsloLocal } from '../utils/time';

const fromDb = (row: TPoopDb): TPoop => ({
  id: row.id,
  createdAt: toOsloIso(row.created_at),
});

export const poopRepository = {
  findAll: (filter: TTimeFilter = {}, babyId: number): TPoop[] => {
    const conditions = ['baby_id = ?', ...(filter.from ? ['created_at >= ?'] : []), ...(filter.to ? ['created_at <= ?'] : [])];
    const params = [babyId, ...(filter.from ? [filter.from] : []), ...(filter.to ? [filter.to] : [])];
    const rows = db.prepare<unknown[], TPoopDb>(`SELECT * FROM poop WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`).all(...params);
    return rows.map(fromDb);
  },

  findById: (id: number, babyId: number): TPoop | null => {
    const row = db.prepare<[number, number], TPoopDb>('SELECT * FROM poop WHERE id = ? AND baby_id = ?').get(id, babyId);
    return row ? fromDb(row) : null;
  },

  insert: (babyId: number, createdBy: number): TPoop => {
    const now = nowOslo();
    const result = db.prepare<[string, number, number]>('INSERT INTO poop (created_at, baby_id, created_by) VALUES (?, ?, ?)').run(now, babyId, createdBy);
    const row = db.prepare<[number], TPoopDb>('SELECT * FROM poop WHERE rowid = ?').get(result.lastInsertRowid as number);
    return fromDb(row!);
  },

  update: (id: number, data: { createdAt?: string }, babyId: number): TPoop | null => {
    if (data.createdAt) {
      db.prepare<[string, number, number]>('UPDATE poop SET created_at = ? WHERE id = ? AND baby_id = ?')
        .run(toOsloLocal(data.createdAt), id, babyId);
    }
    const updated = db.prepare<[number], TPoopDb>('SELECT * FROM poop WHERE id = ?').get(id);
    return updated ? fromDb(updated) : null;
  },

  delete: (id: number, babyId: number): boolean => {
    const result = db.prepare<[number, number]>('DELETE FROM poop WHERE id = ? AND baby_id = ?').run(id, babyId);
    return result.changes > 0;
  },

  getBackup: (from: string, to: string, babyId: number): TPoop[] => {
    const rows = db.prepare<[string, string, number], TPoopDb>(
      'SELECT * FROM poop WHERE created_at >= ? AND created_at <= ? AND baby_id = ?'
    ).all(from, to, babyId);
    return rows.map(fromDb);
  },
};
