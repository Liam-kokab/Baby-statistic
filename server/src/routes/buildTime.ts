import { Router } from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

const router = Router();

const getBuildTime = (): string => {
  const filePath = path.join(__dirname, 'buildTime.json');
  if (!fs.existsSync(filePath)) return 'unknown';
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as { buildTime: string };
  return data.buildTime;
};

router.get('/', (_req: Request, res: Response): void => {
  res.json({ buildTime: getBuildTime() });
});

export default router;

