import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireUser } from '../middleware/requireAdmin';
import { bodyAs } from '../utils/bodyAs';
import type { TBabyContext } from '../types';
import type { TSimpleEvent } from '../repositories/simpleEventRepositoryFactory';
import type { TSimpleEventService } from '../services/simpleEventServiceFactory';

/**
 * Builds a standard CRUD router (GET /, GET /:id, POST /, PUT /:id, DELETE /:id)
 * for a "simple event" service (e.g. pee/poop). Use directly for entities with no
 * extra endpoints; for entities with additional routes (summary, latest, wished
 * expansion, etc.) build a bespoke router instead — see `routes/pumping.ts`.
 */
export const createSimpleEventRouter = <T extends TSimpleEvent>(service: TSimpleEventService<T>): Router => {
  const router = Router();
  router.use(requireUser);
  const ctx = (req: Request): TBabyContext => ({ babyId: req.user!.babyId!, userId: req.user!.id });

  router.get('/', (req: Request, res: Response): void => {
    const { from, to } = req.query as { from?: string; to?: string };
    res.json(service.findAll({ from, to }, ctx(req)));
  });

  router.get('/:id', (req: Request, res: Response): void => {
    const data = service.findById(Number(req.params.id), ctx(req));
    if (!data) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(data);
  });

  router.post('/', (req: Request, res: Response): void => {
    res.status(201).json(service.insert(ctx(req)));
  });

  router.put('/:id', (req: Request, res: Response): void => {
    const { createdAt } = bodyAs<{ createdAt?: string }>(req);
    const data = service.update(Number(req.params.id), { createdAt }, ctx(req));
    if (!data) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(data);
  });

  router.delete('/:id', (req: Request, res: Response): void => {
    const deleted = service.delete(Number(req.params.id), ctx(req));
    if (!deleted) { res.status(404).json({ error: 'Not found' }); return; }
    res.status(204).send();
  });

  return router;
};

