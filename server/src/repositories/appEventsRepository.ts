import type { TAppEvent, TAppEventDb, TAppEventId } from 'baby-statistic-common';
import { db } from '../db';
import { nowOslo } from '../utils/time';

const fromDb = (row: TAppEventDb): TAppEvent => ({
  id: row.id,
  value: row.value,
  updatedAt: row.updated_at,
});

export const appEventsRepository = {
  findById: (id: TAppEventId): TAppEvent | null => {
    const row = db.prepare<[string], TAppEventDb>('SELECT * FROM app_events WHERE id = ?').get(id);
    return row ? fromDb(row) : null;
  },

  upsert: (id: TAppEventId, value: string): TAppEvent => {
    db.prepare(
      `INSERT INTO app_events (id, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run(id, value, nowOslo());
    return appEventsRepository.findById(id)!;
  },
};

