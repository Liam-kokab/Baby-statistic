const BASE_URL = process.env.BABY_API_URL ?? 'http://localhost:3000';

// A baby-scoped API key (format `bsk_...`), created by the baby's owner (or an
// admin) via `POST /api/baby/api-keys` (or `POST /api/admin/api-keys` with a
// `babyId`) — see doc/mcp-server.md. Unlike a plain admin API key, this one
// authenticates as a regular `user` restricted to exactly that baby (see
// server/src/middleware/authenticate.ts), so it works against every
// baby-scoped route the MCP tools call (sleep, drank-milk, pee, poop,
// medicine, pumping, milestones, ...). It never expires and needs no
// login/refresh flow — it stays valid until explicitly revoked (deleted).
const API_KEY = process.env.MCP_API_KEY;

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
  if (!API_KEY) {
    throw new Error(
      'MCP_API_KEY env var must be set to a baby-scoped API key (create one via ' +
        'POST /api/baby/api-keys as the baby owner, or POST /api/admin/api-keys with a ' +
        '"babyId" as an admin) — see doc/mcp-server.md.'
    );
  }

  const url = `${BASE_URL}${path}`;

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
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
