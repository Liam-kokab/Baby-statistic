import { Router } from 'express';
import type { Request, Response } from 'express';
import { poopService } from '../services/poopService';
import { bodyAs } from '../utils/bodyAs';

const router = Router();

router.get('/', (req: Request, res: Response): void => {
  const { from, to } = req.query as { from?: string; to?: string };
  res.json(poopService.findAll({ from, to }));
});

router.get('/:id', (req: Request, res: Response): void => {
  const data = poopService.findById(Number(req.params.id));
  if (!data) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(data);
});

router.post('/', (_req: Request, res: Response): void => {
  res.status(201).json(poopService.insert());
});

router.put('/:id', (req: Request, res: Response): void => {
  const { createdAt } = bodyAs<{ createdAt?: string }>(req);
  const data = poopService.update(Number(req.params.id), { createdAt });
  if (!data) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(data);
});

router.delete('/:id', (req: Request, res: Response): void => {
  const deleted = poopService.delete(Number(req.params.id));
  if (!deleted) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.status(204).send();
});

export default router;
