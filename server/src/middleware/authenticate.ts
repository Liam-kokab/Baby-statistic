import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/authService';
import { apiKeyService } from '../services/apiKeyService';

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
    // Not a valid JWT — fall back to checking whether it's an admin-issued API key.
    // API keys grant admin-role access to any admin endpoint (see requireAdmin),
    // e.g. for the backup-lambda, which has no user password to log in with.
    const apiKeyMatch = apiKeyService.verify(token);
    if (!apiKeyMatch) {
      res.status(401).json({ error: 'Invalid or expired access token' });
      return;
    }
    req.user = {
      id: apiKeyMatch.id,
      username: `api-key:${apiKeyMatch.id}`,
      role: 'admin',
      babyId: null,
      authTime: Math.floor(Date.now() / 1000),
    };
    next();
  }
};

