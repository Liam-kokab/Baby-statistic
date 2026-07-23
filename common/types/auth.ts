export type TUserRole = 'user' | 'admin';

export type TUserConfig = Record<string, unknown>;

export type TUserDb = {
  id: number;
  username: string;
  password_hash: string;
  role: TUserRole;
  baby_id: number | null;
  config: string; // JSON string
  name: string;
  created_at: string;
};

export type TUser = {
  id: number;
  username: string;
  name: string;
  role: TUserRole;
  babyId: number | null;
  config: TUserConfig;
  createdAt: string;
};

export type TBabyDb = {
  id: number;
  name: string;
  created_at: string;
};

export type TBaby = {
  id: number;
  name: string;
  createdAt: string;
};

export type TRefreshTokenDb = {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: string;
  created_at: string;
};

export type TLoginRequest = {
  username: string;
  password: string;
};

export type TLoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: TUser;
};

export type TRefreshResponse = {
  accessToken: string;
  refreshToken: string;
};

export type TJwtPayload = {
  sub: number;
  username: string;
  role: TUserRole;
  babyId: number | null;
  /** Epoch seconds of the user's original /auth/login call. Preserved (not
   * refreshed) across token refreshes — only a real login resets it. Used to
   * gate sensitive actions (e.g. purge) that require a recent explicit login. */
  authTime: number;
};

export type TAdminCreateUser = {
  username: string;
  password: string;
  role: TUserRole;
  babyId?: number | null;
};

export type TAdminCreateBaby = {
  name: string;
};

