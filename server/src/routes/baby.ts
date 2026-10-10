import { Router } from 'express';
import type { Request, Response } from 'express';
import type { TCreateApiKeyRequest } from 'baby-statistic-common';
import { requireUser } from '../middleware/requireAdmin';
import { userRepository } from '../repositories/userRepository';
import { babyRepository } from '../repositories/babyRepository';
import { apiKeyService } from '../services/apiKeyService';
import { bodyAs } from '../utils/bodyAs';

const router = Router();
router.use(requireUser);

// GET /api/baby — current user's baby info
router.get('/', (req: Request, res: Response): void => {
  const baby = babyRepository.findById(req.user!.babyId!);
  if (!baby) {
    res.status(404).json({ error: 'Baby not found' });
    return;
  }
  const users = userRepository.findByBaby(baby.id);
  res.json({ baby, users });
});

// PATCH /api/baby/name — rename the current user's baby
router.patch('/name', (req: Request, res: Response): void => {
  const { name } = bodyAs<{ name?: string }>(req);
  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const baby = babyRepository.update(req.user!.babyId!, { name: name.trim() });
  if (!baby) {
    res.status(404).json({ error: 'Baby not found' });
    return;
  }
  res.json(baby);
});

// POST /api/baby/invite — add another user to your baby by username
router.post('/invite', (req: Request, res: Response): void => {
  const { username } = bodyAs<{ username?: string }>(req);
  if (!username) {
    res.status(400).json({ error: 'username is required' });
    return;
  }
  const target = userRepository.findByUsername(username);
  if (!target) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  if (target.role !== 'user') {
    res.status(400).json({ error: 'Cannot add an admin to a baby' });
    return;
  }
  const babyId = req.user!.babyId!;
  // Update invited user's primary baby if they don't have one
  if (target.baby_id == null) {
    userRepository.update(target.id, { babyId });
  }
  userRepository.addBabyUser(target.id, babyId);
  res.status(201).json({ ok: true });
});

// --- Baby-scoped API keys ---------------------------------------------------
// Any user assigned to this baby (the "owner"/co-owners) can create and revoke
// keys scoped to it — e.g. for the MCP server, so an AI agent can be granted
// access without sharing a real username/password, and revoked independently
// at any time by deleting the key. These keys always authenticate as a
// regular `user` restricted to this one baby (see middleware/authenticate.ts)
// — never as admin, and never usable for any other baby.

// GET /api/baby/api-keys — list this baby's API keys (never the key itself)
router.get('/api-keys', (req: Request, res: Response): void => {
  res.json(apiKeyService.findAllByBaby(req.user!.babyId!));
});

// POST /api/baby/api-keys — create a new key scoped to this baby.
// The raw key is only ever included in this response — it cannot be retrieved afterwards.
router.post('/api-keys', (req: Request, res: Response): void => {
  const { name } = bodyAs<TCreateApiKeyRequest>(req);
  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  res.status(201).json(apiKeyService.create(name.trim(), req.user!.id, req.user!.babyId!));
});

// DELETE /api/baby/api-keys/:id — revoke (delete) a key, only if it belongs to this baby
router.delete('/api-keys/:id', (req: Request, res: Response): void => {
  const deleted = apiKeyService.deleteForBaby(Number(req.params.id), req.user!.babyId!);
  if (!deleted) {
    res.status(404).json({ error: 'API key not found' });
    return;
  }
  res.status(204).send();
});

export default router;
