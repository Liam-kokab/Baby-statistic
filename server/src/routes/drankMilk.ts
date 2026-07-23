import { Router } from 'express';
import type { Request, Response } from 'express';
import type { TPostDrankMilk } from 'baby-statistic-common';
import { drankMilkService } from '../services/drankMilkService';
import { bodyAs } from '../utils/bodyAs';
import { expandToWished } from '../utils/expandToWished';
import { requireUser } from '../middleware/requireAdmin';
import type { TBabyContext } from '../types';

const router = Router();
router.use(requireUser);

const ctx = (req: Request): TBabyContext => ({ babyId: req.user!.babyId!, userId: req.user!.id });

router.get('/summary', (req: Request, res: Response): void => {
  const { from, to } = req.query as { from?: string; to?: string };
  res.json(drankMilkService.findSummary({ from, to }, ctx(req)));
});

router.get('/', (req: Request, res: Response): void => {
  const { from, to, wished } = req.query as { from?: string; to?: string; wished?: string };
  const wishedNum = wished ? Number(wished) : undefined;
  if (wishedNum && to) {
    res.json(expandToWished(wishedNum, from ?? '', to, (f, t) => drankMilkService.findAll({ from: f, to: t }, ctx(req))));
  } else {
    res.json(drankMilkService.findAll({ from, to }, ctx(req)));
  }
});

router.get('/latest', (req: Request, res: Response): void => {
  res.json(drankMilkService.findLatest(ctx(req)));
});

router.get('/suggested', (req: Request, res: Response): void => {
  res.json({ nextDrinkAmount: drankMilkService.suggestNextDrinkAmount(ctx(req)) });
});

router.post('/waste', (req: Request, res: Response): void => {
  const { amount } = bodyAs<{ amount: number }>(req);
  if (!amount || amount <= 0) {
    res.status(400).json({ error: 'Missing required field: amount' });
    return;
  }
  const data = drankMilkService.deductWaste(amount, ctx(req));
  if (!data) {
    res.status(404).json({ error: 'No drank milk records found' });
    return;
  }
  res.json(data);
});

router.get('/:id', (req: Request, res: Response): void => {
  const data = drankMilkService.findById(Number(req.params.id), ctx(req));
  if (!data) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(data);
});

router.post('/', (req: Request, res: Response): void => {
  const { amount, source, isNewBottle } = bodyAs<TPostDrankMilk>(req);
  if (amount === undefined || !source || isNewBottle === undefined) {
    res.status(400).json({ error: 'Missing required fields: amount, source, isNewBottle' });
    return;
  }
  if (source !== 'FRIDGE' && source !== 'FREEZER' && source !== 'BOOB') {
    res.status(400).json({ error: 'source must be FRIDGE, FREEZER, or BOOB' });
    return;
  }
  res.status(201).json(drankMilkService.insert({ amount, source, isNewBottle }, ctx(req)));
});

router.put('/:id', (req: Request, res: Response): void => {
  const data = drankMilkService.update(Number(req.params.id), bodyAs<TPostDrankMilk>(req), ctx(req));
  if (!data) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(data);
});

router.delete('/:id', (req: Request, res: Response): void => {
  const deleted = drankMilkService.delete(Number(req.params.id), ctx(req));
  if (!deleted) { res.status(404).json({ error: 'Not found' }); return; }
  res.status(204).send();
});

export default router;
