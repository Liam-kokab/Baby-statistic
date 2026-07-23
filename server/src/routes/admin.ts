import { Router } from 'express';
import type { Request, Response } from 'express';
import type { TAdminCreateUser, TAdminCreateBaby } from 'baby-statistic-common';
import { hashPassword } from '../services/authService';
import { userRepository } from '../repositories/userRepository';
import { babyRepository } from '../repositories/babyRepository';
import { requireAdmin } from '../middleware/requireAdmin';
import { bodyAs } from '../utils/bodyAs';

const router = Router();
router.use(requireAdmin);

// ── Babies ────────────────────────────────────────────────────────────────────
router.get('/babies', (_req: Request, res: Response): void => {
  res.json(babyRepository.findAll());
});

router.post('/babies', async (req: Request, res: Response): Promise<void> => {
  const { name } = bodyAs<TAdminCreateBaby>(req);
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  res.status(201).json(babyRepository.insert({ name }));
});

router.put('/babies/:id', async (req: Request, res: Response): Promise<void> => {
  const { name } = bodyAs<TAdminCreateBaby>(req);
  const baby = babyRepository.update(Number(req.params.id), { name });
  if (!baby) {
    res.status(404).json({ error: 'Baby not found' });
    return;
  }
  res.json(baby);
});

router.delete('/babies/:id', (req: Request, res: Response): void => {
  const deleted = babyRepository.delete(Number(req.params.id));
  if (!deleted) {
    res.status(404).json({ error: 'Baby not found' });
    return;
  }
  res.status(204).send();
});

// ── Users ─────────────────────────────────────────────────────────────────────
router.get('/users', (_req: Request, res: Response): void => {
  res.json(userRepository.findAll());
});

router.post('/users', async (req: Request, res: Response): Promise<void> => {
  const { username, password, role, babyId, name } = bodyAs<TAdminCreateUser & { password?: string; name?: string }>(req);
  if (!username || !password || !role) {
    res.status(400).json({ error: 'username, password, and role are required' });
    return;
  }
  if (role !== 'user' && role !== 'admin') {
    res.status(400).json({ error: 'role must be "user" or "admin"' });
    return;
  }
  if (role === 'user' && !babyId) {
    res.status(400).json({ error: 'babyId is required for role "user"' });
    return;
  }
  const existing = userRepository.findByUsername(username);
  if (existing) {
    res.status(409).json({ error: 'Username already taken' });
    return;
  }
  const passwordHash = await hashPassword(password);
  const user = userRepository.insert({ username, passwordHash, role, babyId: babyId ?? null, name: name ?? '' });
  if (role === 'user' && babyId) {
    userRepository.addBabyUser(user.id, babyId);
  }
  res.status(201).json(user);
});

router.patch('/users/:id', async (req: Request, res: Response): Promise<void> => {
  const { password, babyId, name } = bodyAs<{ password?: string; babyId?: number | null; name?: string }>(req);
  const patch: { passwordHash?: string; babyId?: number | null; name?: string } = {};
  if (password) patch.passwordHash = await hashPassword(password);
  if (babyId !== undefined) patch.babyId = babyId;
  if (name !== undefined) patch.name = name;
  const user = userRepository.update(Number(req.params.id), patch);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(user);
});

router.delete('/users/:id', (req: Request, res: Response): void => {
  const deleted = userRepository.delete(Number(req.params.id));
  if (!deleted) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.status(204).send();
});

export default router;

