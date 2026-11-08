import type { TBaby, TBabyDb, TAdminCreateBaby } from 'baby-statistic-common';
import { db } from '../db';
import { nowOslo, toOsloIso } from '../utils/time';

const fromDb = (row: TBabyDb): TBaby => ({
  id: row.id,
  name: row.name,
  createdAt: toOsloIso(row.created_at),
  milkColors: { greenMinutes: row.milk_green_minutes, yellowMinutes: row.milk_yellow_minutes },
});

export const babyRepository = {
  findById: (id: number): TBaby | null => {
    const row = db.prepare<[number], TBabyDb>('SELECT * FROM babies WHERE id = ?').get(id);
    return row ? fromDb(row) : null;
  },

  findAll: (): TBaby[] =>
    db.prepare<[], TBabyDb>('SELECT * FROM babies ORDER BY name').all().map(fromDb),

  insert: (data: TAdminCreateBaby): TBaby => {
    const now = nowOslo();
    const result = db.prepare<{ name: string; created_at: string }>(
      'INSERT INTO babies (name, created_at) VALUES (@name, @created_at)'
    ).run({ name: data.name, created_at: now });
    const row = db.prepare<[number], TBabyDb>('SELECT * FROM babies WHERE rowid = ?').get(result.lastInsertRowid as number);
    return fromDb(row!);
  },

  update: (id: number, data: Partial<TAdminCreateBaby>): TBaby | null => {
    const existing = db.prepare<[number], TBabyDb>('SELECT * FROM babies WHERE id = ?').get(id);
    if (!existing) return null;
    const name = data.name ?? existing.name;
    db.prepare<[string, number]>('UPDATE babies SET name = ? WHERE id = ?').run(name, id);
    const row = db.prepare<[number], TBabyDb>('SELECT * FROM babies WHERE id = ?').get(id);
    return row ? fromDb(row) : null;
  },

  updateMilkColors: (id: number, greenMinutes: number, yellowMinutes: number): TBaby | null => {
    db.prepare<[number, number, number]>(
      'UPDATE babies SET milk_green_minutes = ?, milk_yellow_minutes = ? WHERE id = ?'
    ).run(greenMinutes, yellowMinutes, id);
    const row = db.prepare<[number], TBabyDb>('SELECT * FROM babies WHERE id = ?').get(id);
    return row ? fromDb(row) : null;
  },

  delete: (id: number): boolean => {
    const result = db.prepare<[number]>('DELETE FROM babies WHERE id = ?').run(id);
    return result.changes > 0;
  },
};

