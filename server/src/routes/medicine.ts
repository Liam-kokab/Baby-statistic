import { Router } from 'express';
import type { Request, Response } from 'express';
import { medicineService } from '../services/medicineService';
import { bodyAs } from '../utils/bodyAs';

const router = Router();

// ── Collection ────────────────────────────────────────────────────────────────
router.get('/', (_req: Request, res: Response): void => {
  res.json(medicineService.findAllActive());
});

router.get('/all', (_req: Request, res: Response): void => {
  res.json(medicineService.findAll());
});

router.post('/', (req: Request, res: Response): void => {
  const { name } = bodyAs<{ name?: string }>(req);
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  res.status(201).json(medicineService.insert({ name }));
});

// ── Logs (literal paths first, before /:id) ───────────────────────────────────
router.get('/logs', (req: Request, res: Response): void => {
  const { from, to } = req.query as { from?: string; to?: string };
  res.json(medicineService.findLogs({ from, to }));
});

router.get('/logs/:id', (req: Request, res: Response): void => {
  const log = medicineService.findLogById(Number(req.params.id));
  if (!log) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(log);
});

router.put('/logs/:id', (req: Request, res: Response): void => {
  const { takenAt } = bodyAs<{ takenAt?: string }>(req);
  if (!takenAt) { res.status(400).json({ error: 'takenAt is required' }); return; }
  const log = medicineService.updateLog(Number(req.params.id), takenAt);
  if (!log) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(log);
});

router.delete('/logs/:id', (req: Request, res: Response): void => {
  const deleted = medicineService.deleteLog(Number(req.params.id));
  if (!deleted) { res.status(404).json({ error: 'Not found' }); return; }
  res.status(204).send();
});

// ── Single medicine ───────────────────────────────────────────────────────────
router.get('/:id', (req: Request, res: Response): void => {
  const med = medicineService.findById(Number(req.params.id));
  if (!med) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(med);
});

router.put('/:id', (req: Request, res: Response): void => {
  const { name } = bodyAs<{ name?: string }>(req);
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const med = medicineService.update(Number(req.params.id), { name });
  if (!med) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(med);
});

router.patch('/:id/active', (req: Request, res: Response): void => {
  const { isActive } = bodyAs<{ isActive?: boolean }>(req);
  if (typeof isActive !== 'boolean') {
    res.status(400).json({ error: 'isActive (boolean) is required' });
    return;
  }
  const med = medicineService.setActive(Number(req.params.id), isActive);
  if (!med) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(med);
});

router.delete('/:id', (req: Request, res: Response): void => {
  const deleted = medicineService.softDelete(Number(req.params.id));
  if (!deleted) { res.status(404).json({ error: 'Not found' }); return; }
  res.status(204).send();
});

router.post('/:id/log', (req: Request, res: Response): void => {
  const takenAt = (req.body as { takenAt?: string } | undefined)?.takenAt;
  const log = medicineService.logTaken(Number(req.params.id), takenAt);
  res.status(201).json(log);
});

export default router;

