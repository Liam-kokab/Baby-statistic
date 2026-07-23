import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireUser } from '../middleware/requireAdmin';
import { userRepository } from '../repositories/userRepository';
import { babyRepository } from '../repositories/babyRepository';
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

export default router;

