import type { TPee, TPeeDb } from 'baby-statistic-common';
import { db } from '../db';
import type { TTimeFilter } from '../types';
import { nowOslo, toOsloIso, toOsloLocal } from '../utils/time';

const fromDb = (row: TPeeDb): TPee => ({
  id: row.id,
  createdAt: toOsloIso(row.created_at),
});

export const peeRepository = {
  findAll: (filter: TTimeFilter = {}): TPee[] => {
    const conditions = [
      ...(filter.from ? ['created_at >= ?'] : []),
      ...(filter.to ? ['created_at <= ?'] : []),
    ];
    const params = [
      ...(filter.from ? [filter.from] : []),
      ...(filter.to ? [filter.to] : []),
    ];
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare<string[], TPeeDb>(`SELECT * FROM pee ${where} ORDER BY created_at DESC`).all(...params);
    return rows.map(fromDb);
  },


  findById: (id: number): TPee | null => {
    const row = db.prepare<[number], TPeeDb>('SELECT * FROM pee WHERE id = ?').get(id);
    return row ? fromDb(row) : null;
  },

  insert: (): TPee => {
    const now = nowOslo();
    const result = db.prepare<[string]>('INSERT INTO pee (created_at) VALUES (?)').run(now);
    const row = db.prepare<[number], TPeeDb>('SELECT * FROM pee WHERE rowid = ?').get(result.lastInsertRowid as number);
    return fromDb(row!);
  },

  update: (id: number, data: { createdAt?: string } = {}): TPee | null => {
    if (data.createdAt) {
      db.prepare<[string, number]>('UPDATE pee SET created_at = ? WHERE id = ?')
        .run(toOsloLocal(data.createdAt), id);
    }
    const updated = db.prepare<[number], TPeeDb>('SELECT * FROM pee WHERE id = ?').get(id);
    return updated ? fromDb(updated) : null;
  },

  delete: (id: number): boolean => {
    const result = db.prepare<[number]>('DELETE FROM pee WHERE id = ?').run(id);
    return result.changes > 0;
  },

  getBackup: (from: string, to: string): TPee[] => {
    const rows = db.prepare<[string, string], TPeeDb>(
      `SELECT * FROM pee WHERE created_at >= ? AND created_at <= ?`
    ).all(from, to);
    return rows.map(fromDb);
  },
};
