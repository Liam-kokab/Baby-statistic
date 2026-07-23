import type { TSleep, TSleepDb, TPostSleep } from 'baby-statistic-common';
import { db } from '../db';
import type { TTimeFilter } from '../types';
import { nowOslo, toOsloIso, toOsloIsoNullable, toOsloLocal } from '../utils/time';

const fromDb = (row: TSleepDb): TSleep => ({
  id: row.id,
  start: toOsloIso(row.start),
  end: toOsloIsoNullable(row.end),
  createdAt: toOsloIso(row.created_at),
});

const toDb = (data: TPostSleep): Omit<TSleepDb, 'id' | 'created_at' | 'baby_id' | 'created_by'> => ({
  start: toOsloLocal(data.start),
  end: data.end ? toOsloLocal(data.end) : null,
});

export const sleepRepository = {
  findAll: (filter: TTimeFilter = {}, babyId: number): TSleep[] => {
    const conditions = ['baby_id = ?', ...(filter.from ? ['created_at >= ?'] : []), ...(filter.to ? ['created_at <= ?'] : [])];
    const params = [babyId, ...(filter.from ? [filter.from] : []), ...(filter.to ? [filter.to] : [])];
    const rows = db.prepare<unknown[], TSleepDb>(
      `SELECT * FROM sleep WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`
    ).all(...params);
    return rows.map(fromDb);
  },

  findSummaryAgg: (filter: TTimeFilter, babyId: number): { count: number; totalMs: number; activeDays: number } => {
    const conditions = ['baby_id = ?', ...(filter.from ? ['created_at >= ?'] : []), ...(filter.to ? ['created_at <= ?'] : [])];
    const params = [babyId, ...(filter.from ? [filter.from] : []), ...(filter.to ? [filter.to] : [])];
    const row = db.prepare<unknown[], { count: number; totalMs: number; activeDays: number }>(
      `SELECT COUNT(*) AS count,
       COALESCE(SUM(CASE WHEN "end" IS NOT NULL THEN CAST((julianday("end") - julianday(start)) * 86400000 AS INTEGER) ELSE 0 END), 0) AS totalMs,
       COUNT(DISTINCT date(created_at)) AS activeDays
       FROM sleep WHERE ${conditions.join(' AND ')}`
    ).get(...params)!;
    return { count: row.count, totalMs: row.totalMs, activeDays: row.activeDays };
  },

  findOrderedForRange: (filter: TTimeFilter, babyId: number): { start: string; end: string | null }[] => {
    const conditions = ['baby_id = ?', ...(filter.from ? ['created_at >= ?'] : []), ...(filter.to ? ['created_at <= ?'] : [])];
    const params = [babyId, ...(filter.from ? [filter.from] : []), ...(filter.to ? [filter.to] : [])];
    return db.prepare<unknown[], { start: string; end: string | null }>(
      `SELECT start, "end" FROM sleep WHERE ${conditions.join(' AND ')} ORDER BY start ASC`
    ).all(...params).map((r) => ({ start: toOsloIso(r.start), end: r.end ? toOsloIsoNullable(r.end) : null }));
  },

  findLatest: (babyId: number): TSleep | null => {
    const row = db.prepare<[number], TSleepDb>('SELECT * FROM sleep WHERE baby_id = ? ORDER BY start DESC LIMIT 1').get(babyId);
    return row ? fromDb(row) : null;
  },

  findById: (id: number, babyId: number): TSleep | null => {
    const row = db.prepare<[number, number], TSleepDb>('SELECT * FROM sleep WHERE id = ? AND baby_id = ?').get(id, babyId);
    return row ? fromDb(row) : null;
  },

  insert: (data: TPostSleep, babyId: number, createdBy: number): TSleep => {
    const now = nowOslo();
    const mapped = toDb(data);
    const result = db.prepare<{ start: string; end: string | null; created_at: string; baby_id: number; created_by: number }>(
      'INSERT INTO sleep (start, "end", created_at, baby_id, created_by) VALUES (@start, @end, @created_at, @baby_id, @created_by)'
    ).run({ ...mapped, created_at: now, baby_id: babyId, created_by: createdBy });
    const row = db.prepare<[number], TSleepDb>('SELECT * FROM sleep WHERE rowid = ?').get(result.lastInsertRowid as number);
    return fromDb(row!);
  },

  update: (id: number, data: Partial<TPostSleep>, babyId: number): TSleep | null => {
    const existing = db.prepare<[number, number], TSleepDb>('SELECT * FROM sleep WHERE id = ? AND baby_id = ?').get(id, babyId);
    if (!existing) return null;
    const merged = toDb({ start: existing.start, end: existing.end, ...data });
    db.prepare<{ start: string; end: string | null; id: number }>(
      'UPDATE sleep SET start = @start, "end" = @end WHERE id = @id'
    ).run({ ...merged, id });
    const updated = db.prepare<[number], TSleepDb>('SELECT * FROM sleep WHERE id = ?').get(id);
    return updated ? fromDb(updated) : null;
  },

  delete: (id: number, babyId: number): boolean => {
    const result = db.prepare<[number, number]>('DELETE FROM sleep WHERE id = ? AND baby_id = ?').run(id, babyId);
    return result.changes > 0;
  },

  getBackup: (from: string, to: string, babyId: number): TSleep[] => {
    const rows = db.prepare<[string, string, number], TSleepDb>(
      'SELECT * FROM sleep WHERE created_at >= ? AND created_at <= ? AND baby_id = ?'
    ).all(from, to, babyId);
    return rows.map(fromDb);
  },
};
