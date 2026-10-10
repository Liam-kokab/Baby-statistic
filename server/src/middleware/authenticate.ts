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
    // Not a valid JWT — fall back to checking whether it's an API key.
    // A key with baby_id = null grants admin-role access to any admin endpoint
    // (e.g. for the backup-lambda). A key with a non-null baby_id instead grants
    // regular user-role access scoped to exactly that one baby (e.g. for the MCP
    // server) — it can never reach admin-only endpoints (see requireAdmin) and
    // is otherwise indistinguishable from a real user of that baby.
    const apiKeyMatch = apiKeyService.verify(token);
    if (!apiKeyMatch) {
      res.status(401).json({ error: 'Invalid or expired access token' });
      return;
    }
    req.user = {
      id: apiKeyMatch.id,
      username: `api-key:${apiKeyMatch.keyId}`,
      role: apiKeyMatch.babyId == null ? 'admin' : 'user',
      babyId: apiKeyMatch.babyId,
      authTime: Math.floor(Date.now() / 1000),
    };
    next();
  }
};
