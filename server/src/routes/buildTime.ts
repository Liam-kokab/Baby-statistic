import { Router } from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();
router.use(requireAdmin);

const getBuildTime = (): string => {
  const candidates = [
    path.join(__dirname, 'buildTime.json'),            // alongside compiled route
    path.join(__dirname, '..', 'buildTime.json'),     // one level up
    path.resolve(process.cwd(), 'dist', 'buildTime.json'), // packed dist/buildTime.json
    path.resolve(process.cwd(), 'buildTime.json'),    // project root fallback
  ];

  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    if (process.env.NODE_ENV === 'production') {
      // helpful warning in production where packaging may place the file elsewhere
      // eslint-disable-next-line no-console
      console.warn('buildTime.json not found. Tried:', candidates.join(', '));
    }
    return 'unknown';
  }

  try {
    const data = JSON.parse(fs.readFileSync(found, 'utf-8')) as { buildTime: string };
    return data.buildTime;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Failed to read buildTime.json at', found, err);
    return 'unknown';
  }
};

router.get('/', (_req: Request, res: Response): void => {
  res.json({ buildTime: getBuildTime() });
});

export default router;

