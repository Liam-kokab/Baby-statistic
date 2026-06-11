import type { TPoop, TPoopDb } from 'baby-statistic-common';
import { db } from '../db';
import type { TTimeFilter } from '../types';
import { nowOslo, toOsloIso, toOsloLocal } from '../utils/time';

const fromDb = (row: TPoopDb): TPoop => ({
  id: row.id,
  createdAt: toOsloIso(row.created_at),
});

export const poopRepository = {
  findAll: (filter: TTimeFilter = {}): TPoop[] => {
    const conditions = [
      ...(filter.from ? ['created_at >= ?'] : []),
      ...(filter.to ? ['created_at <= ?'] : []),
    ];
    const params = [
      ...(filter.from ? [filter.from] : []),
      ...(filter.to ? [filter.to] : []),
    ];
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare<string[], TPoopDb>(`SELECT * FROM poop ${where} ORDER BY created_at DESC`).all(...params);
    return rows.map(fromDb);
  },


  findById: (id: number): TPoop | null => {
    const row = db.prepare<[number], TPoopDb>('SELECT * FROM poop WHERE id = ?').get(id);
    return row ? fromDb(row) : null;
  },

  insert: (): TPoop => {
    const now = nowOslo();
    const result = db.prepare<[string]>('INSERT INTO poop (created_at) VALUES (?)').run(now);
    const row = db.prepare<[number], TPoopDb>('SELECT * FROM poop WHERE rowid = ?').get(result.lastInsertRowid as number);
    return fromDb(row!);
  },

  update: (id: number, data: { createdAt?: string } = {}): TPoop | null => {
    if (data.createdAt) {
      db.prepare<[string, number]>('UPDATE poop SET created_at = ? WHERE id = ?')
        .run(toOsloLocal(data.createdAt), id);
    }
    const updated = db.prepare<[number], TPoopDb>('SELECT * FROM poop WHERE id = ?').get(id);
    return updated ? fromDb(updated) : null;
  },

  delete: (id: number): boolean => {
    const result = db.prepare<[number]>('DELETE FROM poop WHERE id = ?').run(id);
    return result.changes > 0;
  },

  getBackup: (from: string, to: string): TPoop[] => {
    const rows = db.prepare<[string, string], TPoopDb>(
      `SELECT * FROM poop WHERE created_at >= ? AND created_at <= ?`
    ).all(from, to);
    return rows.map(fromDb);
  },
};
