import { Router } from 'express';
import type { Request, Response } from 'express';
import { homeService } from '../services/homeService';
import { requireUser } from '../middleware/requireAdmin';
import type { TBabyContext } from '../types';

const router = Router();
router.use(requireUser);
const ctx = (req: Request): TBabyContext => ({ babyId: req.user!.babyId!, userId: req.user!.id });

/** GET /api/home/summary — everything the Home page needs, in one call. */
router.get('/summary', (req: Request, res: Response): void => {
  res.json(homeService.getSummary(ctx(req)));
});

/** GET /api/home/always-on-display — lightweight readout shown on every page's black screen. */
router.get('/always-on-display', (req: Request, res: Response): void => {
  res.json(homeService.getAlwaysOnDisplay(ctx(req)));
});

export default router;

