import { Router } from 'express';
import type { Request, Response } from 'express';
import { db } from '../db';
import { toOsloIso } from '../utils/time';
import { expandToWished } from '../utils/expandToWished';

type TNappyRow = { id: number; type: 'pee' | 'poop'; created_at: string };
type TNappyItem = { id: number; type: 'pee' | 'poop'; createdAt: string };

const router = Router();

router.get('/latest', (_req: Request, res: Response): void => {
  const row = db.prepare(`
    SELECT created_at AS createdAt FROM (
      SELECT created_at FROM pee
      UNION ALL
      SELECT created_at FROM poop
    )
    ORDER BY created_at DESC
    LIMIT 1
  `).get() as { createdAt: string } | undefined;

  res.json(row ?? null);
});

/**
 * GET /api/nappy/summary?from&to
 * Returns total pee and poop counts for the given date range.
 */
router.get('/summary', (req: Request, res: Response): void => {
  const { from, to } = req.query as { from?: string; to?: string };
  const conditions = [
    ...(from ? ['created_at >= ?'] : []),
    ...(to   ? ['created_at <= ?'] : []),
  ];
  const params: string[] = [
    ...(from ? [from] : []),
    ...(to   ? [to]   : []),
  ];
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const row = db.prepare<string[], { peeCount: number; poopCount: number }>(
    `SELECT (SELECT COUNT(*) FROM pee ${where}) AS peeCount,
            (SELECT COUNT(*) FROM poop ${where}) AS poopCount`
  ).get(...params, ...params)!;
  res.json(row);
});

/**
 * GET /api/nappy/list?from&to&wished
 * Returns combined pee+poop events sorted descending by created_at.
 * When `wished` is provided, expands the date range backward until that count is reached.
 */
router.get('/list', (req: Request, res: Response): void => {
  const { from, to, wished } = req.query as { from?: string; to?: string; wished?: string };
  const conditions = [
    ...(from ? ['created_at >= ?'] : []),
    ...(to   ? ['created_at <= ?'] : []),
  ];
  const toItem = (row: TNappyRow): TNappyItem => ({
    id: row.id,
    type: row.type,
    createdAt: toOsloIso(row.created_at),
  });

  const fetchNappy = (f: string, t: string): TNappyItem[] => {
    const conds = [`created_at >= ?`, `created_at <= ?`];
    const where = `WHERE ${conds.join(' AND ')}`;
    const cte = `
      SELECT id, 'pee' AS type, created_at FROM pee ${where}
      UNION ALL
      SELECT id, 'poop' AS type, created_at FROM poop ${where}
    `;
    const rows = db.prepare<string[], TNappyRow>(
      `SELECT * FROM (${cte}) ORDER BY created_at DESC`
    ).all(f, t, f, t);
    return rows.map(toItem);
  };

  const wishedNum = wished ? Number(wished) : undefined;
  if (wishedNum && to) {
    res.json(expandToWished(wishedNum, from ?? '', to, fetchNappy));
    return;
  }

  const filterParams: string[] = [
    ...(from ? [from] : []),
    ...(to   ? [to]   : []),
  ];
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const cte = `
    SELECT id, 'pee' AS type, created_at FROM pee ${where}
    UNION ALL
    SELECT id, 'poop' AS type, created_at FROM poop ${where}
  `;
  const rows = db.prepare<string[], TNappyRow>(
    `SELECT * FROM (${cte}) ORDER BY created_at DESC`
  ).all(...filterParams, ...filterParams);
  res.json(rows.map(toItem));
});

export default router;
