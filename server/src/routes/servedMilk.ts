import { Router } from 'express';
import type { Request, Response } from 'express';
import type { TPostServedMilk, TServedMilkStatus } from 'baby-statistic-common';
import { servedMilkService } from '../services/servedMilkService';
import { bodyAs } from '../utils/bodyAs';
import { expandToWished } from '../utils/expandToWished';

const router = Router();

const INITIAL_STATUSES: TServedMilkStatus[] = ['FRIDGE', 'FREEZER'];
const VALID_STATUSES: TServedMilkStatus[]   = ['FRIDGE', 'FREEZER', 'USED', 'EXPIRED'];

router.get('/', (req: Request, res: Response): void => {
  const { from, to, wished } = req.query as { from?: string; to?: string; wished?: string };
  const wishedNum = wished ? Number(wished) : undefined;
  if (wishedNum && to) {
    res.json(expandToWished(wishedNum, from ?? '', to, (f, t) => servedMilkService.findAll({ from: f, to: t })));
  } else {
    res.json(servedMilkService.findAll({ from, to }));
  }
});

router.get('/total', (_req: Request, res: Response): void => {
  res.json(servedMilkService.getTotal());
});

router.get('/:id', (req: Request, res: Response): void => {
  const data = servedMilkService.findById(Number(req.params.id));
  if (!data) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(data);
});

router.post('/', (req: Request, res: Response): void => {
  const { amount, status } = bodyAs<TPostServedMilk>(req);
  if (amount === undefined || !status) {
    res.status(400).json({ error: 'Missing required fields: amount, status' });
    return;
  }
  if (!INITIAL_STATUSES.includes(status)) {
    res.status(400).json({ error: `status on create must be one of: ${INITIAL_STATUSES.join(', ')}` });
    return;
  }
  res.status(201).json(servedMilkService.insert({ amount, originalAmount: amount, status, expiryDate: null }));
});

router.put('/:id', (req: Request, res: Response): void => {
  const id = Number(req.params.id);
  const body = bodyAs<Partial<TPostServedMilk> & { createdAt?: string }>(req);

  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    return;
  }

  const existing = servedMilkService.findById(id);
  if (!existing) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const TERMINAL_STATUSES: TServedMilkStatus[] = ['USED', 'EXPIRED'];
  if (TERMINAL_STATUSES.includes(existing.status)) {
    res.status(409).json({ error: `Cannot update milk with status ${existing.status}` });
    return;
  }

  const data = servedMilkService.update(id, body);
  if (!data) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(data);
});

router.delete('/:id', (req: Request, res: Response): void => {
  const deleted = servedMilkService.delete(Number(req.params.id));
  if (!deleted) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.status(204).send();
});

export default router;
