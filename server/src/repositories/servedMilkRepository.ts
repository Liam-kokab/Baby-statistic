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

const toDb = (data: TPostServedMilk): Omit<TServedMilkDb, 'id' | 'created_at'> => ({
  amount: data.amount,
  original_amount: data.originalAmount,
  status: data.status,
  expiry_date: data.expiryDate ?? null,
});

export const servedMilkRepository = {
  findAll: (filter: TTimeFilter = {}): TServedMilk[] => {
    const conditions = [
      ...(filter.from ? ['created_at >= ?'] : []),
      ...(filter.to ? ['created_at <= ?'] : []),
    ];
    const params = [
      ...(filter.from ? [filter.from] : []),
      ...(filter.to ? [filter.to] : []),
    ];
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare<string[], TServedMilkDb>(`SELECT * FROM served_milk ${where} ORDER BY created_at DESC`).all(...params);
    return rows.map(fromDb);
  },

  findById: (id: number): TServedMilk | null => {
    const row = db.prepare<[number], TServedMilkDb>('SELECT * FROM served_milk WHERE id = ?').get(id);
    return row ? fromDb(row) : null;
  },

  insert: (data: TPostServedMilk): TServedMilk => {
    const now = nowOslo();
    const mapped = toDb(data);
    const result = db.prepare<Omit<TServedMilkDb, 'id' | 'created_at'> & { created_at: string }>(`
      INSERT INTO served_milk (amount, original_amount, status, expiry_date, created_at)
      VALUES (@amount, @original_amount, @status, @expiry_date, @created_at)
    `).run({ ...mapped, created_at: now });
    const row = db.prepare<[number], TServedMilkDb>('SELECT * FROM served_milk WHERE rowid = ?').get(result.lastInsertRowid as number);
    return fromDb(row!);
  },

  update: (id: number, data: Partial<TPostServedMilk> & { createdAt?: string }): TServedMilk | null => {
    const existing = db.prepare<[number], TServedMilkDb>('SELECT * FROM served_milk WHERE id = ?').get(id);
    if (!existing) return null;
    const { createdAt, ...rest } = data;
    const merged = toDb({ ...fromDb(existing), ...rest });
    if (createdAt) {
      db.prepare<Omit<TServedMilkDb, 'id'> & { id: number }>(`
        UPDATE served_milk
        SET amount = @amount, original_amount = @original_amount,
            status = @status, expiry_date = @expiry_date, created_at = @created_at
        WHERE id = @id
      `).run({ ...merged, created_at: toOsloLocal(createdAt), id });
    } else {
      db.prepare<Omit<TServedMilkDb, 'id' | 'created_at'> & { id: number }>(`
        UPDATE served_milk
        SET amount = @amount, original_amount = @original_amount,
            status = @status, expiry_date = @expiry_date
        WHERE id = @id
      `).run({ ...merged, id });
    }
    const updated = db.prepare<[number], TServedMilkDb>('SELECT * FROM served_milk WHERE id = ?').get(id);
    return updated ? fromDb(updated) : null;
  },

  delete: (id: number): boolean => {
    const result = db.prepare<[number]>('DELETE FROM served_milk WHERE id = ?').run(id);
    return result.changes > 0;
  },

  getTotal: (): TServedMilkTotal => {
    const row = db.prepare<[], { fridge: number; freezer: number }>(`
      SELECT
        SUM(CASE WHEN status = 'FRIDGE'  THEN amount ELSE 0 END) AS fridge,
        SUM(CASE WHEN status = 'FREEZER' THEN amount ELSE 0 END) AS freezer
      FROM served_milk
    `).get()!;
    const fridge  = row.fridge  ?? 0;
    const freezer = row.freezer ?? 0;
    return { fridge, freezer, total: fridge + freezer };
  },

  expireOverdue: (): void => {
    db.prepare(`
      UPDATE served_milk
      SET status = 'EXPIRED'
      WHERE status IN ('FRIDGE', 'FREEZER')
        AND expiry_date IS NOT NULL
        AND expiry_date <= ?
    `).run(nowOslo());
  },

  deductStock: (source: TServedMilkStatus, amount: number): void => {
    const run = db.transaction(() => {
      const records = db.prepare<[string], TServedMilkDb>(
        `SELECT * FROM served_milk WHERE status = ? ORDER BY created_at ASC`
      ).all(source);

      const updateStmt = db.prepare<{ amount: number; status: TServedMilkStatus; id: number }>(
        `UPDATE served_milk SET amount = @amount, status = @status WHERE id = @id`
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

  getBackup: (from: string, to: string): TServedMilk[] => {
    const rows = db.prepare<[string, string], TServedMilkDb>(
      `SELECT * FROM served_milk WHERE created_at >= ? AND created_at <= ?`
    ).all(from, to);
    return rows.map(fromDb);
  },
};
