import { db } from '../db';
import type { TTimeFilter } from '../types';
import { nowOslo, toOsloIso, toOsloLocal } from '../utils/time';

/** Shape of a DB row for a "simple event" table (timestamp-only, e.g. pee/poop/pumping). */
export type TSimpleEventDb = {
  id: number;
  created_at: string;
  baby_id: number;
  created_by: number;
};

/** Shape of the API-facing type for a "simple event". */
export type TSimpleEvent = {
  id: number;
  createdAt: string;
};

export type TSimpleEventRepository<T extends TSimpleEvent> = {
  findAll: (filter: TTimeFilter, babyId: number) => T[];
  findLatest: (babyId: number) => T | null;
  findById: (id: number, babyId: number) => T | null;
  insert: (babyId: number, createdBy: number) => T;
  update: (id: number, data: { createdAt?: string }, babyId: number) => T | null;
  delete: (id: number, babyId: number) => boolean;
  getBackup: (from: string, to: string, babyId: number) => T[];
};

/**
 * Builds a repository for a table that only stores a timestamp plus the standard
 * `baby_id`/`created_by` scoping columns (e.g. `pee`, `poop`, `pumping`).
 * `tableName` must be a trusted, hardcoded identifier — never derived from user input.
 */
export const createSimpleEventRepository = <TDb extends TSimpleEventDb, T extends TSimpleEvent>(
  tableName: string,
): TSimpleEventRepository<T> => {
  const fromDb = (row: TDb): T => ({ id: row.id, createdAt: toOsloIso(row.created_at) }) as T;

  return {
    findAll: (filter: TTimeFilter = {}, babyId: number): T[] => {
      const conditions = ['baby_id = ?', ...(filter.from ? ['created_at >= ?'] : []), ...(filter.to ? ['created_at <= ?'] : [])];
      const params = [babyId, ...(filter.from ? [filter.from] : []), ...(filter.to ? [filter.to] : [])];
      const rows = db.prepare<unknown[], TDb>(
        `SELECT * FROM ${tableName} WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`
      ).all(...params);
      return rows.map(fromDb);
    },

    findLatest: (babyId: number): T | null => {
      const row = db.prepare<[number], TDb>(`SELECT * FROM ${tableName} WHERE baby_id = ? ORDER BY created_at DESC LIMIT 1`).get(babyId);
      return row ? fromDb(row) : null;
    },

    findById: (id: number, babyId: number): T | null => {
      const row = db.prepare<[number, number], TDb>(`SELECT * FROM ${tableName} WHERE id = ? AND baby_id = ?`).get(id, babyId);
      return row ? fromDb(row) : null;
    },

    insert: (babyId: number, createdBy: number): T => {
      const now = nowOslo();
      const result = db.prepare<[string, number, number]>(
        `INSERT INTO ${tableName} (created_at, baby_id, created_by) VALUES (?, ?, ?)`
      ).run(now, babyId, createdBy);
      const row = db.prepare<[number], TDb>(`SELECT * FROM ${tableName} WHERE rowid = ?`).get(result.lastInsertRowid as number);
      return fromDb(row!);
    },

    update: (id: number, data: { createdAt?: string }, babyId: number): T | null => {
      if (data.createdAt) {
        db.prepare<[string, number, number]>(`UPDATE ${tableName} SET created_at = ? WHERE id = ? AND baby_id = ?`)
          .run(toOsloLocal(data.createdAt), id, babyId);
      }
      const updated = db.prepare<[number], TDb>(`SELECT * FROM ${tableName} WHERE id = ?`).get(id);
      return updated ? fromDb(updated) : null;
    },

    delete: (id: number, babyId: number): boolean => {
      const result = db.prepare<[number, number]>(`DELETE FROM ${tableName} WHERE id = ? AND baby_id = ?`).run(id, babyId);
      return result.changes > 0;
    },

    getBackup: (from: string, to: string, babyId: number): T[] => {
      const rows = db.prepare<[string, string, number], TDb>(
        `SELECT * FROM ${tableName} WHERE created_at >= ? AND created_at <= ? AND baby_id = ?`
      ).all(from, to, babyId);
      return rows.map(fromDb);
    },
  };
};



