import type { TDrankMilk, TDrankMilkDb, TPostDrankMilk } from 'baby-statistic-common';
import { db } from '../db';
import type { TTimeFilter } from '../types';
import { nowOslo, toOsloIso, toOsloLocal } from '../utils/time';

const fromDb = (row: TDrankMilkDb): TDrankMilk => ({
  id: row.id,
  amount: row.amount,
  source: row.source,
  createdAt: toOsloIso(row.created_at),
});

const toDb = (data: TPostDrankMilk): Omit<TDrankMilkDb, 'id' | 'created_at'> => ({
  amount: data.amount,
  source: data.source,
});

export const drankMilkRepository = {
  findAll: (filter: TTimeFilter = {}): TDrankMilk[] => {
    const conditions = [
      ...(filter.from ? ['created_at >= ?'] : []),
      ...(filter.to ? ['created_at <= ?'] : []),
    ];
    const params = [
      ...(filter.from ? [filter.from] : []),
      ...(filter.to ? [filter.to] : []),
    ];
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare<string[], TDrankMilkDb>(`SELECT * FROM drank_milk ${where} ORDER BY created_at DESC`).all(...params);
    return rows.map(fromDb);
  },

  findById: (id: number): TDrankMilk | null => {
    const row = db.prepare<[number], TDrankMilkDb>('SELECT * FROM drank_milk WHERE id = ?').get(id);
    return row ? fromDb(row) : null;
  },

  insert: (data: TPostDrankMilk): TDrankMilk => {
    const now = nowOslo();
    const mapped = toDb(data);
    const result = db.prepare<Omit<TDrankMilkDb, 'id' | 'created_at'> & { created_at: string }>(`
      INSERT INTO drank_milk (amount, source, created_at) VALUES (@amount, @source, @created_at)
    `).run({ ...mapped, created_at: now });
    const row = db.prepare<[number], TDrankMilkDb>('SELECT * FROM drank_milk WHERE rowid = ?').get(result.lastInsertRowid as number);
    return fromDb(row!);
  },

  update: (id: number, data: Partial<TPostDrankMilk> & { createdAt?: string }): TDrankMilk | null => {
    const existing = db.prepare<[number], TDrankMilkDb>('SELECT * FROM drank_milk WHERE id = ?').get(id);
    if (!existing) return null;
    const { createdAt, ...rest } = data;
    const merged = toDb({ ...fromDb(existing), ...rest });
    if (createdAt) {
      db.prepare<Omit<TDrankMilkDb, 'id'> & { id: number }>(`
        UPDATE drank_milk SET amount = @amount, source = @source, created_at = @created_at WHERE id = @id
      `).run({ ...merged, created_at: toOsloLocal(createdAt), id });
    } else {
      db.prepare<Omit<TDrankMilkDb, 'id' | 'created_at'> & { id: number }>(`
        UPDATE drank_milk SET amount = @amount, source = @source WHERE id = @id
      `).run({ ...merged, id });
    }
    const updated = db.prepare<[number], TDrankMilkDb>('SELECT * FROM drank_milk WHERE id = ?').get(id);
    return updated ? fromDb(updated) : null;
  },

  delete: (id: number): boolean => {
    const result = db.prepare<[number]>('DELETE FROM drank_milk WHERE id = ?').run(id);
    return result.changes > 0;
  },

  deductWaste: (waste: number): TDrankMilk | null => {
    const latest = db.prepare<[], TDrankMilkDb>(
      `SELECT * FROM drank_milk WHERE source IN ('FRIDGE', 'FREEZER') ORDER BY created_at DESC LIMIT 1`
    ).get();
    if (!latest) return null;
    const newAmount = Math.max(0, latest.amount - waste);
    db.prepare<{ amount: number; id: number }>(
      'UPDATE drank_milk SET amount = @amount WHERE id = @id'
    ).run({ amount: newAmount, id: latest.id });
    const updated = db.prepare<[number], TDrankMilkDb>(
      'SELECT * FROM drank_milk WHERE id = ?'
    ).get(latest.id);
    return updated ? fromDb(updated) : null;
  },

  findLatest: (): TDrankMilk | null => {
    const row = db.prepare<[], TDrankMilkDb>(
      `SELECT * FROM drank_milk ORDER BY created_at DESC LIMIT 1`
    ).get();
    return row ? fromDb(row) : null;
  },

  findRecentBySource: (source: string, thresholdOslo: string): TDrankMilk | null => {
    const row = db.prepare<[string, string], TDrankMilkDb>(
      `SELECT * FROM drank_milk WHERE source = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 1`
    ).get(source, thresholdOslo);
    return row ? fromDb(row) : null;
  },

  getBackup: (from: string, to: string): TDrankMilk[] => {
    const rows = db.prepare<[string, string], TDrankMilkDb>(
      `SELECT * FROM drank_milk WHERE created_at >= ? AND created_at <= ?`
    ).all(from, to);
    return rows.map(fromDb);
  },
};
