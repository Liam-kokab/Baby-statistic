import type { TDrankMilk, TDrankMilkDb, TPostDrankMilk, TDrankMilkSummary } from 'baby-statistic-common';
import { db } from '../db';
import type { TTimeFilter } from '../types';
import { nowOslo, toOsloIso, toOsloLocal } from '../utils/time';

const fromDb = (row: TDrankMilkDb): TDrankMilk => ({
  id: row.id,
  amount: row.amount,
  source: row.source,
  createdAt: toOsloIso(row.created_at),
});

const toDb = (data: Omit<TPostDrankMilk, 'isNewBottle'>): Omit<TDrankMilkDb, 'id' | 'created_at' | 'baby_id' | 'created_by'> => ({
  amount: data.amount,
  source: data.source,
});

export const drankMilkRepository = {
  findAll: (filter: TTimeFilter = {}, babyId: number): TDrankMilk[] => {
    const conditions = [
      'baby_id = ?',
      ...(filter.from ? ['created_at >= ?'] : []),
      ...(filter.to ? ['created_at <= ?'] : []),
    ];
    const params = [babyId, ...(filter.from ? [filter.from] : []), ...(filter.to ? [filter.to] : [])];
    const rows = db.prepare<unknown[], TDrankMilkDb>(
      `SELECT * FROM drank_milk WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`
    ).all(...params);
    return rows.map(fromDb);
  },

  findSummary: (filter: TTimeFilter, babyId: number): TDrankMilkSummary => {
    const conditions = [
      'baby_id = ?',
      ...(filter.from ? ['created_at >= ?'] : []),
      ...(filter.to ? ['created_at <= ?'] : []),
    ];
    const params = [babyId, ...(filter.from ? [filter.from] : []), ...(filter.to ? [filter.to] : [])];
    const row = db.prepare<unknown[], { count: number; totalMl: number; activeDays: number; hasBoob: number }>(
      `SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS totalMl,
       COUNT(DISTINCT date(created_at)) AS activeDays,
       MAX(CASE WHEN source = 'BOOB' THEN 1 ELSE 0 END) AS hasBoob
       FROM drank_milk WHERE ${conditions.join(' AND ')}`
    ).get(...params)!;
    return {
      count: row.count,
      totalMl: row.totalMl,
      avgPerDay: row.activeDays > 0 ? Math.round(row.totalMl / row.activeDays) : 0,
      hasBoob: row.hasBoob === 1,
    };
  },

  findById: (id: number, babyId: number): TDrankMilk | null => {
    const row = db.prepare<[number, number], TDrankMilkDb>('SELECT * FROM drank_milk WHERE id = ? AND baby_id = ?').get(id, babyId);
    return row ? fromDb(row) : null;
  },

  insert: (data: TPostDrankMilk, babyId: number, createdBy: number): TDrankMilk => {
    const now = nowOslo();
    const mapped = toDb(data);
    const result = db.prepare<{ amount: number; source: string; created_at: string; baby_id: number; created_by: number }>(
      'INSERT INTO drank_milk (amount, source, created_at, baby_id, created_by) VALUES (@amount, @source, @created_at, @baby_id, @created_by)'
    ).run({ ...mapped, created_at: now, baby_id: babyId, created_by: createdBy });
    const row = db.prepare<[number], TDrankMilkDb>('SELECT * FROM drank_milk WHERE rowid = ?').get(result.lastInsertRowid as number);
    return fromDb(row!);
  },

  update: (id: number, data: Partial<TPostDrankMilk> & { createdAt?: string }, babyId: number): TDrankMilk | null => {
    const existing = db.prepare<[number, number], TDrankMilkDb>('SELECT * FROM drank_milk WHERE id = ? AND baby_id = ?').get(id, babyId);
    if (!existing) return null;
    const { createdAt, isNewBottle: _, ...rest } = data;
    const merged = toDb({ ...fromDb(existing), ...rest });
    if (createdAt) {
      db.prepare<{ amount: number; source: string; created_at: string; id: number }>(
        'UPDATE drank_milk SET amount = @amount, source = @source, created_at = @created_at WHERE id = @id'
      ).run({ ...merged, created_at: toOsloLocal(createdAt), id });
    } else {
      db.prepare<{ amount: number; source: string; id: number }>(
        'UPDATE drank_milk SET amount = @amount, source = @source WHERE id = @id'
      ).run({ ...merged, id });
    }
    const updated = db.prepare<[number], TDrankMilkDb>('SELECT * FROM drank_milk WHERE id = ?').get(id);
    return updated ? fromDb(updated) : null;
  },

  delete: (id: number, babyId: number): boolean => {
    const result = db.prepare<[number, number]>('DELETE FROM drank_milk WHERE id = ? AND baby_id = ?').run(id, babyId);
    return result.changes > 0;
  },

  deductWaste: (waste: number, babyId: number): TDrankMilk | null => {
    const latest = db.prepare<[number], TDrankMilkDb>(
      `SELECT * FROM drank_milk WHERE source IN ('FRIDGE', 'FREEZER') AND baby_id = ? ORDER BY created_at DESC LIMIT 1`
    ).get(babyId);
    if (!latest) return null;
    const newAmount = Math.max(0, latest.amount - waste);
    db.prepare<{ amount: number; id: number }>(
      'UPDATE drank_milk SET amount = @amount WHERE id = @id'
    ).run({ amount: newAmount, id: latest.id });
    const updated = db.prepare<[number], TDrankMilkDb>('SELECT * FROM drank_milk WHERE id = ?').get(latest.id);
    return updated ? fromDb(updated) : null;
  },

  findLatest: (babyId: number): TDrankMilk | null => {
    const row = db.prepare<[number], TDrankMilkDb>(
      'SELECT * FROM drank_milk WHERE baby_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(babyId);
    return row ? fromDb(row) : null;
  },

  getBackup: (from: string, to: string, babyId: number): TDrankMilk[] => {
    const rows = db.prepare<[string, string, number], TDrankMilkDb>(
      'SELECT * FROM drank_milk WHERE created_at >= ? AND created_at <= ? AND baby_id = ?'
    ).all(from, to, babyId);
    return rows.map(fromDb);
  },

  // Used internally by prediction service — no baby scope needed (joins handle it)
  findRecentForPrediction: (babyId: number): TDrankMilkDb[] =>
    db.prepare<[number], TDrankMilkDb>(
      `SELECT * FROM drank_milk WHERE source IN ('FRIDGE','FREEZER') AND baby_id = ? ORDER BY created_at DESC LIMIT 20`
    ).all(babyId),
};
