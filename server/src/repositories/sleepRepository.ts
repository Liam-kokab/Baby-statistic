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

const toDb = (data: TPostSleep): Omit<TSleepDb, 'id' | 'created_at'> => ({
  start: toOsloLocal(data.start),
  end: data.end ? toOsloLocal(data.end) : null,
});

export const sleepRepository = {
  findAll: (filter: TTimeFilter = {}): TSleep[] => {
    const conditions = [
      ...(filter.from ? ['created_at >= ?'] : []),
      ...(filter.to ? ['created_at <= ?'] : []),
    ];
    const params = [
      ...(filter.from ? [filter.from] : []),
      ...(filter.to ? [filter.to] : []),
    ];
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare<string[], TSleepDb>(`SELECT * FROM sleep ${where} ORDER BY created_at DESC`).all(...params);
    return rows.map(fromDb);
  },

  findSummaryAgg: (filter: TTimeFilter): { count: number; totalMs: number; activeDays: number } => {
    const conditions = [
      ...(filter.from ? ['created_at >= ?'] : []),
      ...(filter.to ? ['created_at <= ?'] : []),
    ];
    const params = [
      ...(filter.from ? [filter.from] : []),
      ...(filter.to ? [filter.to] : []),
    ];
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const row = db.prepare<string[], { count: number; totalMs: number; activeDays: number }>(
      `SELECT COUNT(*) AS count,
       COALESCE(SUM(CASE WHEN "end" IS NOT NULL
         THEN CAST((julianday("end") - julianday(start)) * 86400000 AS INTEGER)
         ELSE 0 END), 0) AS totalMs,
       COUNT(DISTINCT date(created_at)) AS activeDays
       FROM sleep ${where}`
    ).get(...params)!;
    const { count, totalMs, activeDays } = row;
    return { count, totalMs, activeDays };
  },

  findOrderedForRange: (filter: TTimeFilter): { start: string; end: string | null }[] => {
    const conditions = [
      ...(filter.from ? ['created_at >= ?'] : []),
      ...(filter.to ? ['created_at <= ?'] : []),
    ];
    const params = [
      ...(filter.from ? [filter.from] : []),
      ...(filter.to ? [filter.to] : []),
    ];
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return db.prepare<string[], { start: string; end: string | null }>(
      `SELECT start, "end" FROM sleep ${where} ORDER BY start ASC`
    ).all(...params).map((r) => ({
      start: toOsloIso(r.start),
      end: r.end ? toOsloIsoNullable(r.end) : null,
    }));
  },

  findLatest: (): TSleep | null => {
    const row = db.prepare<[], TSleepDb>('SELECT * FROM sleep ORDER BY start DESC LIMIT 1').get();
    return row ? fromDb(row) : null;
  },

  findById: (id: number): TSleep | null => {
    const row = db.prepare<[number], TSleepDb>('SELECT * FROM sleep WHERE id = ?').get(id);
    return row ? fromDb(row) : null;
  },

  insert: (data: TPostSleep): TSleep => {
    const now = nowOslo();
    const mapped = toDb(data);
    const result = db.prepare<Omit<TSleepDb, 'id' | 'created_at'> & { created_at: string }>(`
      INSERT INTO sleep (start, "end", created_at) VALUES (@start, @end, @created_at)
    `).run({ ...mapped, created_at: now });
    const row = db.prepare<[number], TSleepDb>('SELECT * FROM sleep WHERE rowid = ?').get(result.lastInsertRowid as number);
    return fromDb(row!);
  },

  update: (id: number, data: Partial<TPostSleep>): TSleep | null => {
    const existing = db.prepare<[number], TSleepDb>('SELECT * FROM sleep WHERE id = ?').get(id);
    if (!existing) return null;
    const merged = toDb({ start: existing.start, end: existing.end, ...data });
    db.prepare<Omit<TSleepDb, 'id' | 'created_at'> & { id: number }>(`
      UPDATE sleep SET start = @start, "end" = @end WHERE id = @id
    `).run({ ...merged, id });
    const updated = db.prepare<[number], TSleepDb>('SELECT * FROM sleep WHERE id = ?').get(id);
    return updated ? fromDb(updated) : null;
  },

  delete: (id: number): boolean => {
    const result = db.prepare<[number]>('DELETE FROM sleep WHERE id = ?').run(id);
    return result.changes > 0;
  },

  getBackup: (from: string, to: string): TSleep[] => {
    const rows = db.prepare<[string, string], TSleepDb>(
      `SELECT * FROM sleep WHERE created_at >= ? AND created_at <= ?`
    ).all(from, to);
    return rows.map(fromDb);
  },
};
