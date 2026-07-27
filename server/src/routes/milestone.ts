import { Router } from 'express';
import type { Request, Response } from 'express';
import { milestoneService } from '../services/milestoneService';
import { bodyAs } from '../utils/bodyAs';
import { requireUser } from '../middleware/requireAdmin';
import type { TBabyContext } from '../types';
import type { TPostMilestone, TUpdateMilestone } from 'baby-statistic-common';

const router = Router();
router.use(requireUser);
const ctx = (req: Request): TBabyContext => ({ babyId: req.user!.babyId!, userId: req.user!.id });

router.get('/', (req: Request, res: Response): void => {
  const { from, to } = req.query as { from?: string; to?: string };
  res.json(milestoneService.findAll({ from, to }, ctx(req)));
});

router.get('/:id', (req: Request, res: Response): void => {
  const data = milestoneService.findById(Number(req.params.id), ctx(req));
  if (!data) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(data);
});

router.post('/', (req: Request, res: Response): void => {
  const { title, description, occurredAt } = bodyAs<TPostMilestone>(req);
  if (!title?.trim()) { res.status(400).json({ error: 'title is required' }); return; }
  res.status(201).json(milestoneService.insert({ title: title.trim(), description, occurredAt }, ctx(req)));
});

router.put('/:id', (req: Request, res: Response): void => {
  const { title, description, occurredAt } = bodyAs<TUpdateMilestone>(req);
  if (title !== undefined && !title.trim()) { res.status(400).json({ error: 'title cannot be empty' }); return; }
  const data = milestoneService.update(Number(req.params.id), { title: title?.trim(), description, occurredAt }, ctx(req));
  if (!data) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(data);
});

router.delete('/:id', (req: Request, res: Response): void => {
  const deleted = milestoneService.delete(Number(req.params.id), ctx(req));
  if (!deleted) { res.status(404).json({ error: 'Not found' }); return; }
  res.status(204).send();
});

export default router;

