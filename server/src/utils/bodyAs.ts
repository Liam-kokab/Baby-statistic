import type { Request } from 'express';

/** Cast `req.body` to `Partial<T>` without inline `as` at every call site. */
export const bodyAs = <T>(req: Request): Partial<T> => req.body as Partial<T>;

