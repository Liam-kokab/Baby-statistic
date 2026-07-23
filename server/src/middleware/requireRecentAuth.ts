import type { Request, Response, NextFunction } from 'express';

/**
 * Gates a route behind a *recent, explicit login* — not just a valid token.
 *
 * `req.user.authTime` is set once at POST /api/auth/login and carried forward
 * unchanged across POST /api/auth/refresh calls (see authService.ts). So
 * unlike a plain expiry check, a silent token refresh can NOT satisfy this —
 * the user must actually log out and log back in within `maxAgeSeconds`.
 *
 * Must run after `authenticate` (needs req.user). Responds 403 (not 401) so
 * client-side auto-refresh-and-retry logic (which only triggers on 401)
 * doesn't silently paper over this check.
 */
export const requireRecentAuth = (maxAgeSeconds: number) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const ageSeconds = Math.floor(Date.now() / 1000) - req.user.authTime;
    if (!Number.isFinite(req.user.authTime) || ageSeconds > maxAgeSeconds) {
      res.status(403).json({
        error: `This action requires a recent login (within ${maxAgeSeconds}s). Please log out and log back in, then try again.`,
        code: 'REAUTH_REQUIRED',
      });
      return;
    }
    next();
  };

