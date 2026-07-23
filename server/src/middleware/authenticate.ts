import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/authService';

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      username: payload.username,
      role: payload.role,
      babyId: payload.babyId,
      authTime: payload.authTime,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired access token' });
  }
};

