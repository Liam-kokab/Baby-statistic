import { Router } from 'express';
import type { Request, Response } from 'express';
import type { TPostSleep } from 'baby-statistic-common';
import { sleepService } from '../services/sleepService';
import { bodyAs } from '../utils/bodyAs';

const router = Router();

router.get('/', (req: Request, res: Response): void => {
  const { from, to } = req.query as { from?: string; to?: string };
  res.json(sleepService.findAll({ from, to }));
});

router.get('/latest', (_req: Request, res: Response): void => {
  const data = sleepService.findLatest();
  res.json(data ?? null);
});

router.get('/:id', (req: Request, res: Response): void => {
  const data = sleepService.findById(Number(req.params.id));
  if (!data) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(data);
});

router.post('/', (req: Request, res: Response): void => {
  const { start, end } = bodyAs<TPostSleep>(req);
  if (!start) {
    res.status(400).json({ error: 'Missing required field: start' });
    return;
  }
  res.status(201).json(sleepService.insert({ start, end: end ?? null }));
});

router.put('/:id', (req: Request, res: Response): void => {
  const data = sleepService.update(Number(req.params.id), bodyAs<TPostSleep>(req));
  if (!data) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(data);
});

router.delete('/:id', (req: Request, res: Response): void => {
  const deleted = sleepService.delete(Number(req.params.id));
  if (!deleted) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.status(204).send();
});

export default router;
