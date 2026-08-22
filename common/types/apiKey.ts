export type TApiKeyDb = {
  id: number;
  name: string;
  key_hash: string;
  created_by: number;
  created_at: string;
};

/** Never includes the raw key or its hash — only safe-to-display metadata. */
export type TApiKey = {
  id: number;
  name: string;
  createdBy: number;
  createdAt: string;
};

export type TCreateApiKeyRequest = {
  name: string;
};

/** Response for `POST /api/admin/api-keys` — `key` is the raw, unhashed value and is
 * shown to the admin exactly once; it cannot be retrieved again after this response. */
export type TCreateApiKeyResponse = TApiKey & {
  key: string;
};

