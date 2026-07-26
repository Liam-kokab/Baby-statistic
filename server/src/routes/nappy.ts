import { Router } from 'express';
import type { Request, Response } from 'express';
import { peeRepository } from '../repositories/peeRepository';
import { poopRepository } from '../repositories/poopRepository';
import { expandToWished } from '../utils/expandToWished';
import { requireUser } from '../middleware/requireAdmin';
import type { TTimeFilter } from '../types';

type TNappyItem = { id: number; type: 'pee' | 'poop'; createdAt: string };

const router = Router();
router.use(requireUser);

/** Merges pee + poop rows into a single list tagged by type, sorted DESC by createdAt. */
const mergeNappyItems = (filter: TTimeFilter, babyId: number): TNappyItem[] => {
  const peeItems = peeRepository.findAll(filter, babyId).map((p): TNappyItem => ({ ...p, type: 'pee' }));
  const poopItems = poopRepository.findAll(filter, babyId).map((p): TNappyItem => ({ ...p, type: 'poop' }));
  return [...peeItems, ...poopItems].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
};

router.get('/latest', (req: Request, res: Response): void => {
  const babyId = req.user!.babyId!;
  const latestPee = peeRepository.findLatest(babyId);
  const latestPoop = poopRepository.findLatest(babyId);
  const candidates: TNappyItem[] = [
    ...(latestPee ? [{ ...latestPee, type: 'pee' as const }] : []),
    ...(latestPoop ? [{ ...latestPoop, type: 'poop' as const }] : []),
  ];
  const latest = candidates.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  res.json(latest ? { createdAt: latest.createdAt } : null);
});

/**
 * GET /api/nappy/summary?from&to
 * Returns total pee and poop counts for the given date range.
 */
router.get('/summary', (req: Request, res: Response): void => {
  const { from, to } = req.query as { from?: string; to?: string };
  const babyId = req.user!.babyId!;
  const filter: TTimeFilter = { ...(from ? { from } : {}), ...(to ? { to } : {}) };
  res.json({
    peeCount: peeRepository.findAll(filter, babyId).length,
    poopCount: poopRepository.findAll(filter, babyId).length,
  });
});

/**
 * GET /api/nappy/list?from&to&wished
 * Returns combined pee+poop events sorted descending by created_at.
 * When `wished` is provided, expands the date range backward until that count is reached.
 */
router.get('/list', (req: Request, res: Response): void => {
  const { from, to, wished } = req.query as { from?: string; to?: string; wished?: string };
  const babyId = req.user!.babyId!;

  const wishedNum = wished ? Number(wished) : undefined;
  if (wishedNum && to) {
    res.json(expandToWished(wishedNum, from ?? '', to, (f, t) => mergeNappyItems({ from: f, to: t }, babyId)));
    return;
  }

  const filter: TTimeFilter = { ...(from ? { from } : {}), ...(to ? { to } : {}) };
  res.json(mergeNappyItems(filter, babyId));
});

export default router;
