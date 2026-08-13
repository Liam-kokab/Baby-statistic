import { Router } from 'express';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import type { TLoginRequest, TUpdateMeRequest } from 'baby-statistic-common';
import { comparePassword, hashPassword, signAccessToken, signRefreshToken, verifyRefreshToken } from '../services/authService';
import { userRepository } from '../repositories/userRepository';
import { authenticate } from '../middleware/authenticate';
import { bodyAs } from '../utils/bodyAs';

const router = Router();

// Brute-force / credential-stuffing protection. Keyed by IP; login is also
// keyed loosely by attempted username via the standard IP-based store since
// express-rate-limit has no built-in per-body-field key (good enough here —
// the goal is to slow down scripted guessing, not provide perfect isolation).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many refresh attempts. Please try again later.' },
});

const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

const refreshExpiresAt = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().replace('T', ' ').slice(0, 19);
};

router.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  const { username, password } = bodyAs<TLoginRequest>(req);
  if (!username || !password) {
    res.status(400).json({ error: 'username and password are required' });
    return;
  }
  const userRow = userRepository.findByUsernameCaseInsensitive(username);
  if (!userRow) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const valid = await comparePassword(password, userRow.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const payload = {
    sub: userRow.id,
    username: userRow.username,
    role: userRow.role,
    babyId: userRow.baby_id,
    authTime: Math.floor(Date.now() / 1000),
  };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(userRow.id, payload.authTime);
  const tokenHash = hashToken(refreshToken);

  userRepository.deleteExpiredRefreshTokens(userRow.id);
  userRepository.saveRefreshToken(userRow.id, tokenHash, refreshExpiresAt());

  res.json({
    accessToken,
    refreshToken,
    user: userRepository.toPublic(userRow),
  });
});

router.post('/refresh', refreshLimiter, (req: Request, res: Response): void => {
  const { refreshToken } = bodyAs<{ refreshToken?: string }>(req);
  if (!refreshToken) {
    res.status(400).json({ error: 'refreshToken is required' });
    return;
  }
  try {
    const { sub: userId, authTime } = verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);
    const stored = userRepository.findRefreshToken(tokenHash);
    if (!stored || stored.user_id !== userId) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }
    if (new Date(stored.expires_at) < new Date()) {
      userRepository.deleteRefreshToken(tokenHash);
      res.status(401).json({ error: 'Refresh token expired' });
      return;
    }
    const userRow = userRepository.findById(userId);
    if (!userRow) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    // Rotate: delete old, issue new. authTime is carried forward (not reset) —
    // it only ever changes on a real /login, so refreshing never "renews" it.
    userRepository.deleteRefreshToken(tokenHash);
    const newRefreshToken = signRefreshToken(userId, authTime);
    const newHash = hashToken(newRefreshToken);
    userRepository.saveRefreshToken(userId, newHash, refreshExpiresAt());

    const newAccessToken = signAccessToken({
      sub: userRow.id,
      username: userRow.username,
      role: userRow.role,
      babyId: userRow.baby_id,
      authTime,
    });
    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

router.post('/logout', authenticate, (req: Request, res: Response): void => {
  const { refreshToken } = bodyAs<{ refreshToken?: string }>(req);
  if (refreshToken) {
    userRepository.deleteRefreshToken(hashToken(refreshToken));
  }
  res.status(204).send();
});

router.get('/me', authenticate, (req: Request, res: Response): void => {
  const userRow = userRepository.findById(req.user!.id);
  if (!userRow) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(userRepository.toPublic(userRow));
});

router.patch('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  const { name, username, currentPassword, newPassword } = bodyAs<TUpdateMeRequest>(req);
  const userId = req.user!.id;
  const userRow = userRepository.findById(userId);
  if (!userRow) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const patch: { name?: string; username?: string; passwordHash?: string } = {};

  if (name !== undefined) {
    if (typeof name !== 'string') {
      res.status(400).json({ error: 'name must be a string' });
      return;
    }
    patch.name = name.trim();
  }

  if (username !== undefined) {
    const trimmed = typeof username === 'string' ? username.trim() : '';
    if (!trimmed) {
      res.status(400).json({ error: 'username must be a non-empty string' });
      return;
    }
    const existing = userRepository.findByUsername(trimmed);
    if (existing && existing.id !== userId) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }
    patch.username = trimmed;
  }

  if (newPassword !== undefined) {
    if (!currentPassword) {
      res.status(400).json({ error: 'currentPassword is required to set a new password' });
      return;
    }
    const valid = await comparePassword(currentPassword, userRow.password_hash);
    if (!valid) {
      res.status(403).json({ error: 'Current password is incorrect' });
      return;
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      res.status(400).json({ error: 'newPassword must be at least 8 characters' });
      return;
    }
    patch.passwordHash = await hashPassword(newPassword);
  }

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: 'No changes provided (name, username, or newPassword+currentPassword required)' });
    return;
  }

  const user = userRepository.update(userId, patch);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(user);
});

export default router;

