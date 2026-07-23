import { Router } from 'express';
import type { Request, Response } from 'express';
import { predictionService } from '../services/predictionService';
import { requireUser } from '../middleware/requireAdmin';
import type { TTimeFilter, TBabyContext } from '../types';

const router = Router();
router.use(requireUser);
const ctx = (req: Request): TBabyContext => ({ babyId: req.user!.babyId!, userId: req.user!.id });

router.get('/', (req: Request, res: Response): void => {
  const { from, to } = req.query as { from?: string; to?: string };
  const filter: TTimeFilter = {};
  if (from) filter.from = from;
  if (to) filter.to = to;
  res.json(predictionService.findAll(filter, ctx(req)));
});

router.get('/latest', (req: Request, res: Response): void => {
  res.json(predictionService.findLatest(ctx(req)));
});

export default router;
