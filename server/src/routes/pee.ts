import { Router } from 'express';
import type { Request, Response } from 'express';
import { peeService } from '../services/peeService';
import { bodyAs } from '../utils/bodyAs';
import { requireUser } from '../middleware/requireAdmin';
import type { TBabyContext } from '../types';

const router = Router();
router.use(requireUser);
const ctx = (req: Request): TBabyContext => ({ babyId: req.user!.babyId!, userId: req.user!.id });

router.get('/', (req: Request, res: Response): void => {
  const { from, to } = req.query as { from?: string; to?: string };
  res.json(peeService.findAll({ from, to }, ctx(req)));
});

router.get('/:id', (req: Request, res: Response): void => {
  const data = peeService.findById(Number(req.params.id), ctx(req));
  if (!data) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(data);
});

router.post('/', (req: Request, res: Response): void => {
  res.status(201).json(peeService.insert(ctx(req)));
});

router.put('/:id', (req: Request, res: Response): void => {
  const { createdAt } = bodyAs<{ createdAt?: string }>(req);
  const data = peeService.update(Number(req.params.id), { createdAt }, ctx(req));
  if (!data) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(data);
});

router.delete('/:id', (req: Request, res: Response): void => {
  const deleted = peeService.delete(Number(req.params.id), ctx(req));
  if (!deleted) { res.status(404).json({ error: 'Not found' }); return; }
  res.status(204).send();
});

export default router;
