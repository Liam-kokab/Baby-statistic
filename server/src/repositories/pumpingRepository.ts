import type { TPumping, TPumpingDb, TPumpingSummary } from 'baby-statistic-common';
import { db } from '../db';
import type { TTimeFilter } from '../types';
import { nowOslo, toOsloIso, toOsloLocal } from '../utils/time';

const fromDb = (row: TPumpingDb): TPumping => ({
  id: row.id,
  createdAt: toOsloIso(row.created_at),
});

export const pumpingRepository = {
  findAll: (filter: TTimeFilter = {}, babyId: number): TPumping[] => {
    const conditions = ['baby_id = ?', ...(filter.from ? ['created_at >= ?'] : []), ...(filter.to ? ['created_at <= ?'] : [])];
    const params = [babyId, ...(filter.from ? [filter.from] : []), ...(filter.to ? [filter.to] : [])];
    const rows = db.prepare<unknown[], TPumpingDb>(
      `SELECT * FROM pumping WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`
    ).all(...params);
    return rows.map(fromDb);
  },

  findSummary: (filter: TTimeFilter, babyId: number): TPumpingSummary => {
    const conditions = ['baby_id = ?', ...(filter.from ? ['created_at >= ?'] : []), ...(filter.to ? ['created_at <= ?'] : [])];
    const params = [babyId, ...(filter.from ? [filter.from] : []), ...(filter.to ? [filter.to] : [])];
    const row = db.prepare<unknown[], { count: number; activeDays: number }>(
      `SELECT COUNT(*) AS count, COUNT(DISTINCT date(created_at)) AS activeDays FROM pumping WHERE ${conditions.join(' AND ')}`
    ).get(...params)!;
    return { count: row.count, avgPerDay: row.activeDays > 0 ? Math.round((row.count / row.activeDays) * 10) / 10 : 0 };
  },

  findLatest: (babyId: number): TPumping | null => {
    const row = db.prepare<[number], TPumpingDb>('SELECT * FROM pumping WHERE baby_id = ? ORDER BY created_at DESC LIMIT 1').get(babyId);
    return row ? fromDb(row) : null;
  },

  findById: (id: number, babyId: number): TPumping | null => {
    const row = db.prepare<[number, number], TPumpingDb>('SELECT * FROM pumping WHERE id = ? AND baby_id = ?').get(id, babyId);
    return row ? fromDb(row) : null;
  },

  insert: (babyId: number, createdBy: number): TPumping => {
    const now = nowOslo();
    const result = db.prepare<[string, number, number]>('INSERT INTO pumping (created_at, baby_id, created_by) VALUES (?, ?, ?)').run(now, babyId, createdBy);
    const row = db.prepare<[number], TPumpingDb>('SELECT * FROM pumping WHERE rowid = ?').get(result.lastInsertRowid as number);
    return fromDb(row!);
  },

  update: (id: number, data: { createdAt?: string }, babyId: number): TPumping | null => {
    if (data.createdAt) {
      db.prepare<[string, number, number]>('UPDATE pumping SET created_at = ? WHERE id = ? AND baby_id = ?')
        .run(toOsloLocal(data.createdAt), id, babyId);
    }
    const updated = db.prepare<[number], TPumpingDb>('SELECT * FROM pumping WHERE id = ?').get(id);
    return updated ? fromDb(updated) : null;
  },

  delete: (id: number, babyId: number): boolean => {
    const result = db.prepare<[number, number]>('DELETE FROM pumping WHERE id = ? AND baby_id = ?').run(id, babyId);
    return result.changes > 0;
  },
};
