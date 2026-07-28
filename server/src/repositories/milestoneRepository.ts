import type { TMilestone, TMilestoneDb, TPostMilestone, TUpdateMilestone } from 'baby-statistic-common';
import { db } from '../db';
import { nowOslo, toOsloIso } from '../utils/time';
import type { TTimeFilter } from '../types';

const normalizeDateOnly = (value: string): string => value.slice(0, 10);

const fromDb = (row: TMilestoneDb): TMilestone => ({
  id: row.id,
  title: row.title,
  description: row.description,
  occurredAt: normalizeDateOnly(row.occurred_at),
  createdAt: toOsloIso(row.created_at),
});

export const milestoneRepository = {
  findAll: (filter: TTimeFilter, babyId: number): TMilestone[] => {
    const from = filter.from ? normalizeDateOnly(filter.from) : undefined;
    const to = filter.to ? normalizeDateOnly(filter.to) : undefined;
    const conditions = ['baby_id = ?', ...(from ? ['substr(occurred_at, 1, 10) >= ?'] : []), ...(to ? ['substr(occurred_at, 1, 10) <= ?'] : [])];
    const params = [babyId, ...(from ? [from] : []), ...(to ? [to] : [])];
    const rows = db.prepare<unknown[], TMilestoneDb>(
      `SELECT * FROM milestone WHERE ${conditions.join(' AND ')} ORDER BY substr(occurred_at, 1, 10) DESC, id DESC`
    ).all(...params);
    return rows.map(fromDb);
  },

  findById: (id: number, babyId: number): TMilestone | null => {
    const row = db.prepare<[number, number], TMilestoneDb>('SELECT * FROM milestone WHERE id = ? AND baby_id = ?').get(id, babyId);
    return row ? fromDb(row) : null;
  },

  insert: (data: TPostMilestone, babyId: number, createdBy: number): TMilestone => {
    const now = nowOslo();
    const occurredAt = normalizeDateOnly(data.occurredAt ?? now);
    const result = db.prepare<{ title: string; description: string | null; occurred_at: string; created_at: string; baby_id: number; created_by: number }>(
      `INSERT INTO milestone (title, description, occurred_at, created_at, baby_id, created_by)
       VALUES (@title, @description, @occurred_at, @created_at, @baby_id, @created_by)`
    ).run({
      title: data.title,
      description: data.description ?? null,
      occurred_at: occurredAt,
      created_at: now,
      baby_id: babyId,
      created_by: createdBy,
    });
    const row = db.prepare<[number], TMilestoneDb>('SELECT * FROM milestone WHERE rowid = ?').get(result.lastInsertRowid as number);
    return fromDb(row!);
  },

  update: (id: number, data: TUpdateMilestone, babyId: number): TMilestone | null => {
    const existing = db.prepare<[number, number], TMilestoneDb>('SELECT * FROM milestone WHERE id = ? AND baby_id = ?').get(id, babyId);
    if (!existing) return null;
    const title = data.title ?? existing.title;
    const description = data.description !== undefined ? data.description : existing.description;
    const occurredAt = data.occurredAt ? normalizeDateOnly(data.occurredAt) : normalizeDateOnly(existing.occurred_at);
    db.prepare<[string, string | null, string, number, number]>(
      'UPDATE milestone SET title = ?, description = ?, occurred_at = ? WHERE id = ? AND baby_id = ?'
    ).run(title, description, occurredAt, id, babyId);
    const row = db.prepare<[number], TMilestoneDb>('SELECT * FROM milestone WHERE id = ?').get(id);
    return row ? fromDb(row) : null;
  },

  delete: (id: number, babyId: number): boolean => {
    const result = db.prepare<[number, number]>('DELETE FROM milestone WHERE id = ? AND baby_id = ?').run(id, babyId);
    return result.changes > 0;
  },

  getBackup: (from: string, to: string, babyId: number): TMilestone[] => {
    const fromDate = normalizeDateOnly(from);
    const toDate = normalizeDateOnly(to);
    const rows = db.prepare<[string, string, number], TMilestoneDb>(
      'SELECT * FROM milestone WHERE substr(occurred_at, 1, 10) >= ? AND substr(occurred_at, 1, 10) <= ? AND baby_id = ?'
    ).all(fromDate, toDate, babyId);
    return rows.map(fromDb);
  },
};

