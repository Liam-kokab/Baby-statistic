import { Router } from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import type { TLoginRequest } from 'baby-statistic-common';
import { comparePassword, signAccessToken, signRefreshToken, verifyRefreshToken } from '../services/authService';
import { userRepository } from '../repositories/userRepository';
import { authenticate } from '../middleware/authenticate';
import { bodyAs } from '../utils/bodyAs';

const router = Router();

const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

const refreshExpiresAt = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().replace('T', ' ').slice(0, 19);
};

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = bodyAs<TLoginRequest>(req);
  if (!username || !password) {
    res.status(400).json({ error: 'username and password are required' });
    return;
  }
  const userRow = userRepository.findByUsername(username);
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

router.post('/refresh', (req: Request, res: Response): void => {
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

router.patch('/me', authenticate, (req: Request, res: Response): void => {
  const { name } = bodyAs<{ name?: string }>(req);
  if (typeof name !== 'string') {
    res.status(400).json({ error: 'name (string) is required' });
    return;
  }
  const user = userRepository.update(req.user!.id, { name: name.trim() });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(user);
});

export default router;

