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
  'milestone',
] as const;

// Tables purged by DELETE /api/backup/purge. Same as DATA_TABLES, plus
// prediction_log (excluded from backup/restore, but still app data that
// should be wiped on a full purge).
const PURGE_TABLES = [...DATA_TABLES, 'prediction_log'] as const;

type TTableName = (typeof DATA_TABLES)[number];
type TPurgeTableName = (typeof PURGE_TABLES)[number];
type TRow = Record<string, unknown>;
type TBackupPayload = Partial<Record<TTableName, TRow[]>>;

// Runtime guards — table names are never sourced from request input in this file,
// but every SQL string below is built via these guards (never raw interpolation
// of an unchecked value) so this stays true even if the code changes later.
const assertDataTable = (table: string): TTableName => {
  if (!(DATA_TABLES as readonly string[]).includes(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }
  return table as TTableName;
};

const assertPurgeTable = (table: string): TPurgeTableName => {
  if (!(PURGE_TABLES as readonly string[]).includes(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }
  return table as TPurgeTableName;
};

// Column names for INSERT OR REPLACE come from the restore payload's own keys,
// which IS user input — validate against a strict identifier pattern so they
// can never break out of the column-list position in the generated SQL.
const COLUMN_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const assertValidColumn = (column: string): string => {
  if (!COLUMN_NAME_RE.test(column)) {
    throw new Error(`Invalid column name: ${column}`);
  }
  return column;
};

router.get('/', (_req: Request, res: Response): void => {
  const result = {} as Record<TTableName, TRow[]>;
  DATA_TABLES.forEach((table) => {
    const safeTable = assertDataTable(table);
    result[table] = db.prepare(`SELECT * FROM ${safeTable}`).all() as TRow[];
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
  try {
    const restoreAll = db.transaction(() => {
      DATA_TABLES.forEach((table) => {
        const rows = payload[table];
        if (!Array.isArray(rows) || rows.length === 0) return;
        const safeTable = assertDataTable(table);
        const columns = Object.keys(rows[0]).map(assertValidColumn);
        if (columns.length === 0) return;
        const placeholders = columns.map(() => '?').join(', ');
        const stmt = db.prepare(
          `INSERT OR REPLACE INTO ${safeTable} (${columns.join(', ')}) VALUES (${placeholders})`
        );
        rows.forEach((row) => {
          stmt.run(columns.map((col) => row[col] ?? null));
        });
        stats[table] = rows.length;
      });
    });
    restoreAll();
    res.json({ ok: true, inserted: stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

// Irreversibly deletes ALL rows from every data table (all babies), plus every
// baby and every non-admin user (baby_users / refresh_tokens rows for those
// users cascade-delete automatically — see migration 014_auth). Only admin
// accounts survive. Requires { "confirm": "PURGE" } in the body as a
// safeguard against accidental calls, and a login within the last
// PURGE_MAX_AUTH_AGE_SECONDS (requireRecentAuth) — a silent token refresh does
// NOT count, the admin must log out and back in.
// Body is already parsed by the global express.json() middleware (see index.ts) —
// only /api/backup/restore is excluded from that, so no extra json() parser here.
router.delete('/purge', requireRecentAuth(PURGE_MAX_AUTH_AGE_SECONDS), (req: Request, res: Response): void => {
  const { confirm } = (req.body ?? {}) as { confirm?: string };
  if (confirm !== 'PURGE') {
    res.status(400).json({ error: 'Refusing to purge: send { "confirm": "PURGE" } in the request body.' });
    return;
  }

  const stats: Record<string, number> = {};
  try {
    const purgeAll = db.transaction(() => {
      PURGE_TABLES.forEach((table) => {
        const safeTable = assertPurgeTable(table);
        const { changes } = db.prepare(`DELETE FROM ${safeTable}`).run();
        stats[table] = changes;
      });
      const placeholders = PURGE_TABLES.map(() => '?').join(', ');
      db.prepare(
        `DELETE FROM sqlite_sequence WHERE name IN (${placeholders})`
      ).run(...PURGE_TABLES);

      // Wipe every non-admin user (cascades baby_users + refresh_tokens for
      // them) and every baby, leaving only admin accounts behind.
      const { changes: usersDeleted } = db.prepare(`DELETE FROM users WHERE role != 'admin'`).run();
      stats.users = usersDeleted;
      const { changes: babiesDeleted } = db.prepare('DELETE FROM babies').run();
      stats.babies = babiesDeleted;
      db.prepare(`DELETE FROM sqlite_sequence WHERE name = 'babies'`).run();
    });
    purgeAll();
    res.json({ ok: true, deleted: stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;


