import { Router } from 'express';
import type { Request, Response } from 'express';
import { pumpingService } from '../services/pumpingService';
import { bodyAs } from '../utils/bodyAs';
import { expandToWished } from '../utils/expandToWished';
import { requireUser } from '../middleware/requireAdmin';
import type { TBabyContext } from '../types';

const router = Router();
router.use(requireUser);
const ctx = (req: Request): TBabyContext => ({ babyId: req.user!.babyId!, userId: req.user!.id });

router.get('/summary', (req: Request, res: Response): void => {
  const { from, to } = req.query as { from?: string; to?: string };
  res.json(pumpingService.findSummary({ from, to }, ctx(req)));
});

router.get('/', (req: Request, res: Response): void => {
  const { from, to, wished } = req.query as { from?: string; to?: string; wished?: string };
  const wishedNum = wished ? Number(wished) : undefined;
  if (wishedNum && to) {
    res.json(expandToWished(wishedNum, from ?? '', to, (f, t) => pumpingService.findAll({ from: f, to: t }, ctx(req))));
  } else {
    res.json(pumpingService.findAll({ from, to }, ctx(req)));
  }
});

router.get('/latest', (req: Request, res: Response): void => {
  res.json(pumpingService.findLatest(ctx(req)));
});

router.get('/:id', (req: Request, res: Response): void => {
  const data = pumpingService.findById(Number(req.params.id), ctx(req));
  if (!data) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(data);
});

router.post('/', (req: Request, res: Response): void => {
  res.status(201).json(pumpingService.insert(ctx(req)));
});

router.put('/:id', (req: Request, res: Response): void => {
  const { createdAt } = bodyAs<{ createdAt?: string }>(req);
  const data = pumpingService.update(Number(req.params.id), { createdAt }, ctx(req));
  if (!data) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(data);
});

router.delete('/:id', (req: Request, res: Response): void => {
  const deleted = pumpingService.delete(Number(req.params.id), ctx(req));
  if (!deleted) { res.status(404).json({ error: 'Not found' }); return; }
  res.status(204).send();
});

export default router;
