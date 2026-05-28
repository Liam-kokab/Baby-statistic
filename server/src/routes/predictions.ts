import { Router } from 'express';
import type { Request, Response } from 'express';
import { predictionService } from '../services/predictionService';
import type { TTimeFilter } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response): void => {
  const { from, to } = req.query as { from?: string; to?: string };
  const filter: TTimeFilter = {};
  if (from) filter.from = from;
  if (to) filter.to = to;
  res.json(predictionService.findAll(filter));
});

router.get('/latest', (_req: Request, res: Response): void => {
  res.json(predictionService.findLatest());
});

export default router;

