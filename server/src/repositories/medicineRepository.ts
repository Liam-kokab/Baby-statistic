import type { TMedicine, TMedicineDb, TMedicineLog, TMedicineLogDb, TPostMedicine, TMedicineWithLatestLog } from 'baby-statistic-common';
import { db } from '../db';
import { nowOslo, toOsloIso, toOsloLocal } from '../utils/time';
import type { TTimeFilter } from '../types';

const fromMedicineDb = (row: TMedicineDb): TMedicine => ({
  id: row.id,
  name: row.name,
  isActive: Boolean(row.is_active),
  createdAt: toOsloIso(row.created_at),
});

const fromLogDb = (row: TMedicineLogDb): TMedicineLog => ({
  id: row.id,
  medicineId: row.medicine_id,
  takenAt: toOsloIso(row.taken_at),
  createdAt: toOsloIso(row.created_at),
});

export const medicineRepository = {
  findAllActive: (): TMedicineWithLatestLog[] => {
    const medicines = db
      .prepare<[], TMedicineDb>('SELECT * FROM medicine WHERE is_active = 1 ORDER BY name')
      .all();
    return medicines.map((m) => {
      const latestLog = db
        .prepare<[number], TMedicineLogDb>(
          'SELECT * FROM medicine_log WHERE medicine_id = ? ORDER BY taken_at DESC LIMIT 1',
        )
        .get(m.id);
      return {
        ...fromMedicineDb(m),
        latestTakenAt: latestLog ? toOsloIso(latestLog.taken_at) : null,
      };
    });
  },

  insert: (data: TPostMedicine): TMedicine => {
    const now = nowOslo();
    const result = db
      .prepare<{ name: string; created_at: string }>(
        'INSERT INTO medicine (name, created_at) VALUES (@name, @created_at)',
      )
      .run({ name: data.name, created_at: now });
    const row = db.prepare<[number], TMedicineDb>('SELECT * FROM medicine WHERE rowid = ?').get(result.lastInsertRowid as number);    return fromMedicineDb(row!);
  },

  findAll: (): TMedicine[] => {
    const rows = db.prepare<[], TMedicineDb>('SELECT * FROM medicine ORDER BY name').all();
    return rows.map(fromMedicineDb);
  },

  setActive: (id: number, isActive: boolean): TMedicine | null => {
    db.prepare<[number, number]>('UPDATE medicine SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, id);
    const row = db.prepare<[number], TMedicineDb>('SELECT * FROM medicine WHERE id = ?').get(id);
    return row ? fromMedicineDb(row) : null;
  },

  softDelete: (id: number): boolean => {
    const result = db.prepare<[number]>('UPDATE medicine SET is_active = 0 WHERE id = ?').run(id);
    if (result.changes > 0) {
      db.prepare<[number]>('DELETE FROM medicine_log WHERE medicine_id = ?').run(id);
    }
    return result.changes > 0;
  },

  findById: (id: number): TMedicine | null => {
    const row = db.prepare<[number], TMedicineDb>('SELECT * FROM medicine WHERE id = ?').get(id);
    return row ? fromMedicineDb(row) : null;
  },

  update: (id: number, data: TPostMedicine): TMedicine | null => {
    db.prepare<[string, number]>(
      'UPDATE medicine SET name = ? WHERE id = ?',
    ).run(data.name, id);
    const row = db.prepare<[number], TMedicineDb>('SELECT * FROM medicine WHERE id = ?').get(id);
    return row ? fromMedicineDb(row) : null;
  },

  insertLog: (medicineId: number, takenAt: string): TMedicineLog => {
    const now = nowOslo();
    const takenAtLocal = toOsloLocal(takenAt);
    const result = db
      .prepare<{ medicine_id: number; taken_at: string; created_at: string }>(
        'INSERT INTO medicine_log (medicine_id, taken_at, created_at) VALUES (@medicine_id, @taken_at, @created_at)',
      )
      .run({ medicine_id: medicineId, taken_at: takenAtLocal, created_at: now });
    const row = db.prepare<[number], TMedicineLogDb>('SELECT * FROM medicine_log WHERE rowid = ?').get(result.lastInsertRowid as number);
    return fromLogDb(row!);
  },

  findLogs: (filter: TTimeFilter = {}): TMedicineLog[] => {
    const conditions = [
      ...(filter.from ? ['taken_at >= ?'] : []),
      ...(filter.to ? ['taken_at <= ?'] : []),
    ];
    const params = [
      ...(filter.from ? [filter.from] : []),
      ...(filter.to ? [filter.to] : []),
    ];
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db
      .prepare<string[], TMedicineLogDb>(`SELECT * FROM medicine_log ${where} ORDER BY taken_at DESC`)
      .all(...params);
    return rows.map(fromLogDb);
  },


  findLogById: (id: number): TMedicineLog | null => {
    const row = db.prepare<[number], TMedicineLogDb>('SELECT * FROM medicine_log WHERE id = ?').get(id);
    return row ? fromLogDb(row) : null;
  },

  updateLog: (id: number, takenAt: string): TMedicineLog | null => {
    db.prepare<[string, number]>(
      'UPDATE medicine_log SET taken_at = ? WHERE id = ?',
    ).run(toOsloLocal(takenAt), id);
    const row = db.prepare<[number], TMedicineLogDb>('SELECT * FROM medicine_log WHERE id = ?').get(id);
    return row ? fromLogDb(row) : null;
  },

  deleteLog: (id: number): boolean => {
    const result = db.prepare<[number]>('DELETE FROM medicine_log WHERE id = ?').run(id);
    return result.changes > 0;
  },
};
