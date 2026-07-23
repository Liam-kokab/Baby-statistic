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
  findAllActive: (babyId: number): TMedicineWithLatestLog[] => {
    const medicines = db.prepare<[number], TMedicineDb>('SELECT * FROM medicine WHERE is_active = 1 AND baby_id = ? ORDER BY name').all(babyId);
    return medicines.map((m) => {
      const latestLog = db.prepare<[number], TMedicineLogDb>(
        'SELECT * FROM medicine_log WHERE medicine_id = ? ORDER BY taken_at DESC LIMIT 1'
      ).get(m.id);
      return { ...fromMedicineDb(m), latestTakenAt: latestLog ? toOsloIso(latestLog.taken_at) : null };
    });
  },

  insert: (data: TPostMedicine, babyId: number, createdBy: number): TMedicine => {
    const now = nowOslo();
    const result = db.prepare<{ name: string; created_at: string; baby_id: number; created_by: number }>(
      'INSERT INTO medicine (name, created_at, baby_id, created_by) VALUES (@name, @created_at, @baby_id, @created_by)'
    ).run({ name: data.name, created_at: now, baby_id: babyId, created_by: createdBy });
    const row = db.prepare<[number], TMedicineDb>('SELECT * FROM medicine WHERE rowid = ?').get(result.lastInsertRowid as number);
    return fromMedicineDb(row!);
  },

  findAll: (babyId: number): TMedicine[] => {
    const rows = db.prepare<[number], TMedicineDb>('SELECT * FROM medicine WHERE baby_id = ? ORDER BY name').all(babyId);
    return rows.map(fromMedicineDb);
  },

  setActive: (id: number, isActive: boolean, babyId: number): TMedicine | null => {
    db.prepare<[number, number, number]>('UPDATE medicine SET is_active = ? WHERE id = ? AND baby_id = ?').run(isActive ? 1 : 0, id, babyId);
    const row = db.prepare<[number], TMedicineDb>('SELECT * FROM medicine WHERE id = ?').get(id);
    return row ? fromMedicineDb(row) : null;
  },

  softDelete: (id: number, babyId: number): boolean => {
    const result = db.prepare<[number, number]>('UPDATE medicine SET is_active = 0 WHERE id = ? AND baby_id = ?').run(id, babyId);
    if (result.changes > 0) {
      db.prepare<[number]>('DELETE FROM medicine_log WHERE medicine_id = ?').run(id);
    }
    return result.changes > 0;
  },

  findById: (id: number, babyId: number): TMedicine | null => {
    const row = db.prepare<[number, number], TMedicineDb>('SELECT * FROM medicine WHERE id = ? AND baby_id = ?').get(id, babyId);
    return row ? fromMedicineDb(row) : null;
  },

  update: (id: number, data: TPostMedicine, babyId: number): TMedicine | null => {
    db.prepare<[string, number, number]>('UPDATE medicine SET name = ? WHERE id = ? AND baby_id = ?').run(data.name, id, babyId);
    const row = db.prepare<[number], TMedicineDb>('SELECT * FROM medicine WHERE id = ?').get(id);
    return row ? fromMedicineDb(row) : null;
  },

  insertLog: (medicineId: number, takenAt: string, babyId: number, createdBy: number): TMedicineLog => {
    const now = nowOslo();
    const takenAtLocal = toOsloLocal(takenAt);
    const result = db.prepare<{ medicine_id: number; taken_at: string; created_at: string; baby_id: number; created_by: number }>(
      'INSERT INTO medicine_log (medicine_id, taken_at, created_at, baby_id, created_by) VALUES (@medicine_id, @taken_at, @created_at, @baby_id, @created_by)'
    ).run({ medicine_id: medicineId, taken_at: takenAtLocal, created_at: now, baby_id: babyId, created_by: createdBy });
    const row = db.prepare<[number], TMedicineLogDb>('SELECT * FROM medicine_log WHERE rowid = ?').get(result.lastInsertRowid as number);
    return fromLogDb(row!);
  },

  findLogs: (filter: TTimeFilter = {}, babyId: number): TMedicineLog[] => {
    const conditions = ['baby_id = ?', ...(filter.from ? ['taken_at >= ?'] : []), ...(filter.to ? ['taken_at <= ?'] : [])];
    const params = [babyId, ...(filter.from ? [filter.from] : []), ...(filter.to ? [filter.to] : [])];
    const rows = db.prepare<unknown[], TMedicineLogDb>(
      `SELECT * FROM medicine_log WHERE ${conditions.join(' AND ')} ORDER BY taken_at DESC`
    ).all(...params);
    return rows.map(fromLogDb);
  },

  findLogById: (id: number, babyId: number): TMedicineLog | null => {
    const row = db.prepare<[number, number], TMedicineLogDb>('SELECT * FROM medicine_log WHERE id = ? AND baby_id = ?').get(id, babyId);
    return row ? fromLogDb(row) : null;
  },

  updateLog: (id: number, takenAt: string, babyId: number): TMedicineLog | null => {
    db.prepare<[string, number, number]>('UPDATE medicine_log SET taken_at = ? WHERE id = ? AND baby_id = ?').run(toOsloLocal(takenAt), id, babyId);
    const row = db.prepare<[number], TMedicineLogDb>('SELECT * FROM medicine_log WHERE id = ?').get(id);
    return row ? fromLogDb(row) : null;
  },

  deleteLog: (id: number, babyId: number): boolean => {
    const result = db.prepare<[number, number]>('DELETE FROM medicine_log WHERE id = ? AND baby_id = ?').run(id, babyId);
    return result.changes > 0;
  },
};
