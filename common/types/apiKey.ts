export type TApiKeyDb = {
  id: number;
  name: string;
  key_hash: string;
  created_by: number;
  created_at: string;
  /** NULL = admin-scoped key (unrestricted admin access). Non-null = restricted to this one baby. */
  baby_id: number | null;
};

/** Never includes the raw key or its hash — only safe-to-display metadata. */
export type TApiKey = {
  id: number;
  name: string;
  createdBy: number;
  createdAt: string;
  /** NULL = admin-scoped key. Non-null = restricted to this one baby (see server/src/middleware/authenticate.ts). */
  babyId: number | null;
};

export type TCreateApiKeyRequest = {
  name: string;
  /** Admin-only: create a baby-scoped key for the given baby instead of an admin-scoped one. */
  babyId?: number;
};

/** Response for `POST /api/admin/api-keys` — `key` is the raw, unhashed value and is
 * shown to the admin exactly once; it cannot be retrieved again after this response. */
export type TCreateApiKeyResponse = TApiKey & {
  key: string;
};
