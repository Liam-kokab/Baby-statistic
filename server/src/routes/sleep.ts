import { Router } from 'express';
import type { Request, Response } from 'express';
import type { TPostSleep } from 'baby-statistic-common';
import { sleepService } from '../services/sleepService';
import { bodyAs } from '../utils/bodyAs';
import { expandToWished } from '../utils/expandToWished';
import { requireUser } from '../middleware/requireAdmin';
import type { TBabyContext } from '../types';

const router = Router();
router.use(requireUser);
const ctx = (req: Request): TBabyContext => ({ babyId: req.user!.babyId!, userId: req.user!.id });

router.get('/summary', (req: Request, res: Response): void => {
  const { from, to } = req.query as { from?: string; to?: string };
  res.json(sleepService.findSummary({ from, to }, ctx(req)));
});

router.get('/', (req: Request, res: Response): void => {
  const { from, to, wished } = req.query as { from?: string; to?: string; wished?: string };
  const wishedNum = wished ? Number(wished) : undefined;
  if (wishedNum && to) {
    res.json(expandToWished(wishedNum, from ?? '', to, (f, t) => sleepService.findAll({ from: f, to: t }, ctx(req))));
  } else {
    res.json(sleepService.findAll({ from, to }, ctx(req)));
  }
});

router.get('/latest', (req: Request, res: Response): void => {
  res.json(sleepService.findLatest(ctx(req)) ?? null);
});

router.get('/:id', (req: Request, res: Response): void => {
  const data = sleepService.findById(Number(req.params.id), ctx(req));
  if (!data) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(data);
});

router.post('/', (req: Request, res: Response): void => {
  const { start, end } = bodyAs<TPostSleep>(req);
  if (!start) { res.status(400).json({ error: 'Missing required field: start' }); return; }
  res.status(201).json(sleepService.insert({ start, end: end ?? null }, ctx(req)));
});

router.put('/:id', (req: Request, res: Response): void => {
  const data = sleepService.update(Number(req.params.id), bodyAs<TPostSleep>(req), ctx(req));
  if (!data) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(data);
});

router.delete('/:id', (req: Request, res: Response): void => {
  const deleted = sleepService.delete(Number(req.params.id), ctx(req));
  if (!deleted) { res.status(404).json({ error: 'Not found' }); return; }
  res.status(204).send();
});

export default router;
