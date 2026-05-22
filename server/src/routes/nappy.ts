import { Router } from 'express';
import type { Request, Response } from 'express';
import { db } from '../db';

const router = Router();

router.get('/latest', (_req: Request, res: Response): void => {
  const row = db.prepare(`
    SELECT created_at AS createdAt FROM (
      SELECT created_at FROM pee
      UNION ALL
      SELECT created_at FROM poop
    )
    ORDER BY created_at DESC
    LIMIT 1
  `).get() as { createdAt: string } | undefined;

  res.json(row ?? null);
});

export default router;

