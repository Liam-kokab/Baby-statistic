import { Router } from 'express';
import type { Request, Response } from 'express';
import { db } from '../db';
import { toOsloIso } from '../utils/time';
import { expandToWished } from '../utils/expandToWished';
import { requireUser } from '../middleware/requireAdmin';

type TNappyRow = { id: number; type: 'pee' | 'poop'; created_at: string };
type TNappyItem = { id: number; type: 'pee' | 'poop'; createdAt: string };

const router = Router();
router.use(requireUser);

router.get('/latest', (req: Request, res: Response): void => {
  const babyId = req.user!.babyId!;
  const row = db.prepare<[number, number], { createdAt: string }>(`
    SELECT created_at AS createdAt FROM (
      SELECT created_at FROM pee WHERE baby_id = ?
      UNION ALL
      SELECT created_at FROM poop WHERE baby_id = ?
    )
    ORDER BY created_at DESC
    LIMIT 1
  `).get(babyId, babyId);
  res.json(row ?? null);
});

/**
 * GET /api/nappy/summary?from&to
 * Returns total pee and poop counts for the given date range.
 */
router.get('/summary', (req: Request, res: Response): void => {
  const { from, to } = req.query as { from?: string; to?: string };
  const babyId = req.user!.babyId!;
  const conditions = [
    'baby_id = ?',
    ...(from ? ['created_at >= ?'] : []),
    ...(to   ? ['created_at <= ?'] : []),
  ];
  const baseParams = [babyId, ...(from ? [from] : []), ...(to ? [to] : [])];
  const where = `WHERE ${conditions.join(' AND ')}`;
  const row = db.prepare<unknown[], { peeCount: number; poopCount: number }>(
    `SELECT (SELECT COUNT(*) FROM pee ${where}) AS peeCount,
            (SELECT COUNT(*) FROM poop ${where}) AS poopCount`
  ).get(...baseParams, ...baseParams)!;
  res.json(row);
});

/**
 * GET /api/nappy/list?from&to&wished
 * Returns combined pee+poop events sorted descending by created_at.
 * When `wished` is provided, expands the date range backward until that count is reached.
 */
router.get('/list', (req: Request, res: Response): void => {
  const { from, to, wished } = req.query as { from?: string; to?: string; wished?: string };
  const babyId = req.user!.babyId!;

  const toItem = (row: TNappyRow): TNappyItem => ({
    id: row.id,
    type: row.type,
    createdAt: toOsloIso(row.created_at),
  });

  const fetchNappy = (f: string, t: string): TNappyItem[] => {
    const where = `WHERE baby_id = ? AND created_at >= ? AND created_at <= ?`;
    const cte = `
      SELECT id, 'pee' AS type, created_at FROM pee ${where}
      UNION ALL
      SELECT id, 'poop' AS type, created_at FROM poop ${where}
    `;
    const rows = db.prepare<unknown[], TNappyRow>(
      `SELECT * FROM (${cte}) ORDER BY created_at DESC`
    ).all(babyId, f, t, babyId, f, t);
    return rows.map(toItem);
  };

  const wishedNum = wished ? Number(wished) : undefined;
  if (wishedNum && to) {
    res.json(expandToWished(wishedNum, from ?? '', to, fetchNappy));
    return;
  }

  const conditions = [
    'baby_id = ?',
    ...(from ? ['created_at >= ?'] : []),
    ...(to   ? ['created_at <= ?'] : []),
  ];
  const params = [babyId, ...(from ? [from] : []), ...(to ? [to] : [])];
  const where = `WHERE ${conditions.join(' AND ')}`;
  const cte = `
    SELECT id, 'pee' AS type, created_at FROM pee ${where}
    UNION ALL
    SELECT id, 'poop' AS type, created_at FROM poop ${where}
  `;
  const rows = db.prepare<unknown[], TNappyRow>(
    `SELECT * FROM (${cte}) ORDER BY created_at DESC`
  ).all(...params, ...params);
  res.json(rows.map(toItem));
});

export default router;
