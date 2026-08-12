import { Router } from 'express';
import type { Request, Response } from 'express';
import { appEventsService } from '../services/appEventsService';
import { requireAdmin } from '../middleware/requireAdmin';
import { bodyAs } from '../utils/bodyAs';
import type { TPostBackupStatus } from 'baby-statistic-common';

const router = Router();

// GET is available to any authenticated user (admin or baby user) — the global
// `authenticate` middleware (see index.ts) already ran, no extra role check needed.
router.get('/backup', (_req: Request, res: Response): void => {
  res.json(appEventsService.getBackupStatus());
});

// POST is admin-only — only the backup-lambda (which logs in as an admin) reports success.
router.post('/backup', requireAdmin, (req: Request, res: Response): void => {
  const { timestamp } = bodyAs<TPostBackupStatus>(req);
  res.status(201).json(appEventsService.reportBackupSuccess(timestamp));
});

export default router;

