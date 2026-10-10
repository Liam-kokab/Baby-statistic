import { Router } from 'express';
import type { Request, Response } from 'express';
import type { TCreateApiKeyRequest } from 'baby-statistic-common';
import { apiKeyService } from '../services/apiKeyService';
import { babyRepository } from '../repositories/babyRepository';
import { requireAdmin } from '../middleware/requireAdmin';
import { bodyAs } from '../utils/bodyAs';

const router = Router();
router.use(requireAdmin);

router.get('/', (_req: Request, res: Response): void => {
  res.json(apiKeyService.findAll());
});

// The raw key is only ever included in this response — it is not retrievable afterwards.
router.post('/', (req: Request, res: Response): void => {
  const { name, babyId } = bodyAs<TCreateApiKeyRequest>(req);
  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  if (babyId !== undefined) {
    if (typeof babyId !== 'number' || !babyRepository.findById(babyId)) {
      res.status(400).json({ error: 'babyId must reference an existing baby' });
      return;
    }
  }
  res.status(201).json(apiKeyService.create(name.trim(), req.user!.id, babyId ?? null));
});

router.delete('/:id', (req: Request, res: Response): void => {
  const deleted = apiKeyService.delete(Number(req.params.id));
  if (!deleted) {
    res.status(404).json({ error: 'API key not found' });
    return;
  }
  res.status(204).send();
});

export default router;
