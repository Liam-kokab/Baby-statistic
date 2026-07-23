import { Router, json } from 'express';
import type { Request, Response } from 'express';
import { db } from '../db';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();
router.use(requireAdmin);

const DATA_TABLES = [
  'served_milk',
  'drank_milk',
  'sleep',
  'pee',
  'poop',
  'medicine',
  'medicine_log',
  'pumping',
] as const;

type TTableName = (typeof DATA_TABLES)[number];
type TRow = Record<string, unknown>;
type TBackupPayload = Partial<Record<TTableName, TRow[]>>;

router.get('/', (_req: Request, res: Response): void => {
  const result = {} as Record<TTableName, TRow[]>;
  DATA_TABLES.forEach((table) => {
    result[table] = db.prepare(`SELECT * FROM ${table}`).all() as TRow[];
  });
  res.json(result);
});

// Large limit — restore payloads can contain the full database export.
router.post('/restore', json({ limit: '20mb' }), (req: Request, res: Response): void => {
  const payload = req.body as TBackupPayload;
  if (!payload || typeof payload !== 'object') {
    res.status(400).json({ error: 'Request body must be a JSON object.' });
    return;
  }
  const stats: Record<string, number> = {};
  const restoreAll = db.transaction(() => {
    DATA_TABLES.forEach((table) => {
      const rows = payload[table];
      if (!Array.isArray(rows) || rows.length === 0) return;
      const columns = Object.keys(rows[0]);
      if (columns.length === 0) return;
      const placeholders = columns.map(() => '?').join(', ');
      const stmt = db.prepare(
        `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
      );
      rows.forEach((row) => {
        stmt.run(columns.map((col) => row[col] ?? null));
      });
      stats[table] = rows.length;
    });
  });
  try {
    restoreAll();
    res.json({ ok: true, inserted: stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

export default router;
