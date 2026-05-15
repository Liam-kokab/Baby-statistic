import { Router } from 'express';
import type { Request, Response } from 'express';
import { pumpingService } from '../services/pumpingService';
import { bodyAs } from '../utils/bodyAs';

const router = Router();

router.get('/', (req: Request, res: Response): void => {
  const { from, to } = req.query as { from?: string; to?: string };
  res.json(pumpingService.findAll({ from, to }));
});

router.get('/latest', (_req: Request, res: Response): void => {
  res.json(pumpingService.findLatest());
});

router.get('/:id', (req: Request, res: Response): void => {
  const data = pumpingService.findById(Number(req.params.id));
  if (!data) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(data);
});

router.post('/', (_req: Request, res: Response): void => {
  res.status(201).json(pumpingService.insert());
});

router.put('/:id', (req: Request, res: Response): void => {
  const { createdAt } = bodyAs<{ createdAt?: string }>(req);
  const data = pumpingService.update(Number(req.params.id), { createdAt });
  if (!data) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(data);
});

router.delete('/:id', (req: Request, res: Response): void => {
  const deleted = pumpingService.delete(Number(req.params.id));
  if (!deleted) { res.status(404).json({ error: 'Not found' }); return; }
  res.status(204).send();
});

export default router;

