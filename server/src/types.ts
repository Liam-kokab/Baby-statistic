import type { TUserRole } from 'baby-statistic-common';

export type TTimeFilter = {
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export type TAuthUser = {
  id: number;
  username: string;
  role: TUserRole;
  babyId: number | null;
  /** Epoch seconds of the original login (see TJwtPayload.authTime). */
  authTime: number;
};

export type TBabyContext = {
  babyId: number;
  userId: number;
};

// Augment Express Request to include user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TAuthUser;
    }
  }
}
