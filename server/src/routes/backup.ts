import { Router, json } from 'express';
import type { Request, Response } from 'express';
import { db } from '../db';
import { requireAdmin } from '../middleware/requireAdmin';
import { requireRecentAuth } from '../middleware/requireRecentAuth';

const router = Router();
router.use(requireAdmin);

// Purge requires a login within the last 5 minutes — see requireRecentAuth.
const PURGE_MAX_AUTH_AGE_SECONDS = 5 * 60;

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

// Tables purged by DELETE /api/backup/purge. Same as DATA_TABLES, plus
// prediction_log (excluded from backup/restore, but still app data that
// should be wiped on a full purge).
const PURGE_TABLES = [...DATA_TABLES, 'prediction_log'] as const;

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

// Irreversibly deletes ALL rows from every data table (all babies). Requires
// { "confirm": "PURGE" } in the body as a safeguard against accidental calls,
// and a login within the last PURGE_MAX_AUTH_AGE_SECONDS (requireRecentAuth) —
// a silent token refresh does NOT count, the admin must log out and back in.
// Body is already parsed by the global express.json() middleware (see index.ts) —
// only /api/backup/restore is excluded from that, so no extra json() parser here.
router.delete('/purge', requireRecentAuth(PURGE_MAX_AUTH_AGE_SECONDS), (req: Request, res: Response): void => {
  const { confirm } = (req.body ?? {}) as { confirm?: string };
  if (confirm !== 'PURGE') {
    res.status(400).json({ error: 'Refusing to purge: send { "confirm": "PURGE" } in the request body.' });
    return;
  }

  const stats: Record<string, number> = {};
  const purgeAll = db.transaction(() => {
    PURGE_TABLES.forEach((table) => {
      const { changes } = db.prepare(`DELETE FROM ${table}`).run();
      stats[table] = changes;
    });
    db.prepare(
      `DELETE FROM sqlite_sequence WHERE name IN (${PURGE_TABLES.map(() => '?').join(', ')})`
    ).run(...PURGE_TABLES);
  });

  try {
    purgeAll();
    res.json({ ok: true, deleted: stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
