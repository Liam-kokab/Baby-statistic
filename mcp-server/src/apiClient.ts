import { AsyncLocalStorage } from 'async_hooks';

const BASE_URL = process.env.BABY_API_URL ?? 'http://localhost:3000';

// Per-connection API key supplied by the connecting SSE client (Authorization header).
// When running inside this context, the env key is never used.
export const requestContext = new AsyncLocalStorage<{ apiKey: string }>();

// A baby-scoped API key (format `bsk_...`), created by the baby's owner (or an
// admin) via `POST /api/baby/api-keys` (or `POST /api/admin/api-keys` with a
// `babyId`) — see doc/mcp-server.md. Unlike a plain admin API key, this one
// authenticates as a regular `user` restricted to exactly that baby (see
// server/src/middleware/authenticate.ts), so it works against every
// baby-scoped route the MCP tools call (sleep, drank-milk, pee, poop,
// medicine, pumping, milestones, ...). It never expires and needs no
// login/refresh flow — it stays valid until explicitly revoked (deleted).
const ENV_API_KEY = process.env.MCP_API_KEY; // stdio/local use only

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type ApiResponse = {
  status: number;
  data: unknown;
};

export const apiCall = async (
  method: HttpMethod,
  path: string,
  body?: unknown
): Promise<ApiResponse> => {
  const ctx = requestContext.getStore();
  // SSE connections must use their own key; only stdio falls back to the env key.
  const apiKey = ctx ? ctx.apiKey : ENV_API_KEY;
  if (!apiKey) {
    throw new Error(
      'No API key: SSE clients must send "Authorization: Bearer <baby-scoped key>"; ' +
        'stdio mode needs MCP_API_KEY — see doc/mcp-server.md.'
    );
  }

  const url = `${BASE_URL}${path}`;

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (response.status === 204) {
    return { status: 204, data: { success: true } };
  }

  const data: unknown = await response.json().catch(() => null);
  return { status: response.status, data };
};
