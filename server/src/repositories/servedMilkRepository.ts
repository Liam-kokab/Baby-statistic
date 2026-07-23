import type { TServedMilk, TServedMilkDb, TPostServedMilk, TServedMilkTotal, TServedMilkStatus } from 'baby-statistic-common';
import { db } from '../db';
import type { TTimeFilter } from '../types';
import { nowOslo, toOsloIso, toOsloLocal } from '../utils/time';

const fromDb = (row: TServedMilkDb): TServedMilk => ({
  id: row.id,
  amount: row.amount,
  originalAmount: row.original_amount,
  status: row.status,
  expiryDate: row.expiry_date,
  createdAt: toOsloIso(row.created_at),
});

const toDb = (data: TPostServedMilk): Omit<TServedMilkDb, 'id' | 'created_at' | 'baby_id' | 'created_by'> => ({
  amount: data.amount,
  original_amount: data.originalAmount,
  status: data.status,
  expiry_date: data.expiryDate ?? null,
});

export const servedMilkRepository = {
  findAll: (filter: TTimeFilter = {}, babyId: number): TServedMilk[] => {
    const conditions = ['baby_id = ?', ...(filter.from ? ['created_at >= ?'] : []), ...(filter.to ? ['created_at <= ?'] : [])];
    const params = [babyId, ...(filter.from ? [filter.from] : []), ...(filter.to ? [filter.to] : [])];
    const rows = db.prepare<unknown[], TServedMilkDb>(
      `SELECT * FROM served_milk WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`
    ).all(...params);
    return rows.map(fromDb);
  },

  findById: (id: number, babyId: number): TServedMilk | null => {
    const row = db.prepare<[number, number], TServedMilkDb>('SELECT * FROM served_milk WHERE id = ? AND baby_id = ?').get(id, babyId);
    return row ? fromDb(row) : null;
  },

  insert: (data: TPostServedMilk, babyId: number, createdBy: number): TServedMilk => {
    const now = nowOslo();
    const mapped = toDb(data);
    const result = db.prepare<{ amount: number; original_amount: number; status: string; expiry_date: string | null; created_at: string; baby_id: number; created_by: number }>(
      'INSERT INTO served_milk (amount, original_amount, status, expiry_date, created_at, baby_id, created_by) VALUES (@amount, @original_amount, @status, @expiry_date, @created_at, @baby_id, @created_by)'
    ).run({ ...mapped, created_at: now, baby_id: babyId, created_by: createdBy });
    const row = db.prepare<[number], TServedMilkDb>('SELECT * FROM served_milk WHERE rowid = ?').get(result.lastInsertRowid as number);
    return fromDb(row!);
  },

  update: (id: number, data: Partial<TPostServedMilk> & { createdAt?: string }, babyId: number): TServedMilk | null => {
    const existing = db.prepare<[number, number], TServedMilkDb>('SELECT * FROM served_milk WHERE id = ? AND baby_id = ?').get(id, babyId);
    if (!existing) return null;
    const { createdAt, ...rest } = data;
    const merged = toDb({ ...fromDb(existing), ...rest });
    if (createdAt) {
      db.prepare<{ amount: number; original_amount: number; status: string; expiry_date: string | null; created_at: string; id: number }>(
        'UPDATE served_milk SET amount = @amount, original_amount = @original_amount, status = @status, expiry_date = @expiry_date, created_at = @created_at WHERE id = @id'
      ).run({ ...merged, created_at: toOsloLocal(createdAt), id });
    } else {
      db.prepare<{ amount: number; original_amount: number; status: string; expiry_date: string | null; id: number }>(
        'UPDATE served_milk SET amount = @amount, original_amount = @original_amount, status = @status, expiry_date = @expiry_date WHERE id = @id'
      ).run({ ...merged, id });
    }
    const updated = db.prepare<[number], TServedMilkDb>('SELECT * FROM served_milk WHERE id = ?').get(id);
    return updated ? fromDb(updated) : null;
  },

  delete: (id: number, babyId: number): boolean => {
    const result = db.prepare<[number, number]>('DELETE FROM served_milk WHERE id = ? AND baby_id = ?').run(id, babyId);
    return result.changes > 0;
  },

  getTotal: (babyId: number): TServedMilkTotal => {
    const row = db.prepare<[number], { fridge: number; freezer: number }>(
      `SELECT SUM(CASE WHEN status = 'FRIDGE' THEN amount ELSE 0 END) AS fridge, SUM(CASE WHEN status = 'FREEZER' THEN amount ELSE 0 END) AS freezer FROM served_milk WHERE baby_id = ?`
    ).get(babyId)!;
    const fridge  = row.fridge  ?? 0;
    const freezer = row.freezer ?? 0;
    return { fridge, freezer, total: fridge + freezer };
  },

  expireOverdue: (babyId: number): void => {
    db.prepare<[string, number]>(
      `UPDATE served_milk SET status = 'EXPIRED' WHERE status IN ('FRIDGE', 'FREEZER') AND expiry_date IS NOT NULL AND expiry_date <= ? AND baby_id = ?`
    ).run(nowOslo(), babyId);
  },

  deductStock: (source: TServedMilkStatus, amount: number, babyId: number): void => {
    const run = db.transaction(() => {
      const records = db.prepare<[string, number], TServedMilkDb>(
        'SELECT * FROM served_milk WHERE status = ? AND baby_id = ? ORDER BY created_at'
      ).all(source, babyId);
      const updateStmt = db.prepare<{ amount: number; status: TServedMilkStatus; id: number }>(
        'UPDATE served_milk SET amount = @amount, status = @status WHERE id = @id'
      );
      records.reduce((remaining, record) => {
        if (remaining <= 0) return 0;
        if (record.amount <= remaining) {
          updateStmt.run({ amount: 0, status: 'USED', id: record.id });
          return remaining - record.amount;
        }
        updateStmt.run({ amount: record.amount - remaining, status: record.status, id: record.id });
        return 0;
      }, amount);
    });
    run();
  },

  getBackup: (from: string, to: string, babyId: number): TServedMilk[] => {
    const rows = db.prepare<[string, string, number], TServedMilkDb>(
      'SELECT * FROM served_milk WHERE created_at >= ? AND created_at <= ? AND baby_id = ?'
    ).all(from, to, babyId);
    return rows.map(fromDb);
  },
};
