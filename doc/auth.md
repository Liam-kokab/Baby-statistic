# Authentication & Authorisation

## Overview

The application uses **JWT-based stateless authentication** with short-lived access tokens and rotating refresh tokens. There is **no self-registration** — only an admin can create users and babies. Passwords are hashed with **bcrypt + salt** (12 rounds by default).

---

## Roles

| Role | Description |
|---|---|
| `admin` | Full system access. Manages babies and users. Has **no baby** assigned. Cannot log data. |
| `user` | Regular user assigned to exactly one baby. Logs all data (milk, sleep, nappies, etc.) scoped to their baby. Can invite other users to share their baby. |

---

## Token Architecture

### Access Token
- **Algorithm**: HS256 (HMAC-SHA256)
- **Lifetime**: 15 minutes
- **Secret**: `JWT_ACCESS_SECRET` env var
- **Payload**:
```json
{
  "sub": 1,
  "username": "alice",
  "role": "user",
  "babyId": 3,
  "authTime": 1784840767
}
```
- Sent in every request as `Authorization: Bearer <accessToken>`
- `authTime` (epoch seconds) is set **only** at `/api/auth/login` and carried forward unchanged across every `/api/auth/refresh` call — it never resets on refresh, only on a real login. Used by `requireRecentAuth` to gate sensitive actions (see below).

### Refresh Token
- **Algorithm**: HS256
- **Lifetime**: 7 days
- **Secret**: `JWT_REFRESH_SECRET` env var (`.env` file — see Security Notes)
- **Payload**: `{ "sub": <userId>, "authTime": <original login epoch seconds> }` — `authTime` is copied forward on every rotation, never regenerated
- **Storage**: Raw token sent to client; only the **SHA-256 hash** is stored in the `refresh_tokens` DB table
- **Rotation**: On every `/api/auth/refresh` call the old token is deleted and a new one issued — stolen tokens cannot be reused

---

## Token Flow

```
1. Client → POST /api/auth/login { username, password }
2. Server looks up the user case-insensitively (username lookup is case-insensitive; password is not)
3. Server verifies password (bcrypt.compare)
4. Server returns { accessToken (15 min), refreshToken (7 days), user }
5. Client stores both in localStorage

6. Client → GET /api/... with Authorization: Bearer <accessToken>
7. Server middleware verifies token, sets req.user

8. [Token expires]
9. Client → POST /api/auth/refresh { refreshToken }
10. Server verifies token hash in DB, issues new access + refresh pair (rotation)
11. Client updates localStorage with new tokens

12. Client → POST /api/auth/logout { refreshToken }
13. Server deletes refresh token hash from DB
14. Client clears localStorage
```

---

## Step-Up Auth for Sensitive Actions (`requireRecentAuth`)

Some destructive actions require more than just a valid, non-expired token — they require proof of a **recent, explicit login**. `server/src/middleware/requireRecentAuth.ts` exports `requireRecentAuth(maxAgeSeconds)`, a middleware factory used after `authenticate`:

```ts
router.delete('/purge', requireRecentAuth(5 * 60), handler);
```

It computes `ageSeconds = now - req.user.authTime` and rejects with **`403`** (not `401`) if the token's `authTime` is older than `maxAgeSeconds`:

```json
{ "error": "This action requires a recent login (within 300s). Please log out and log back in, then try again.", "code": "REAUTH_REQUIRED" }
```

**Why 403 and not 401**: the client's `authFetch` auto-refreshes and retries once on `401` (see below). Since a silent refresh does **not** change `authTime`, returning `401` here would cause the client to transparently refresh and retry — defeating the whole point. `403` is never auto-retried, so the user actually sees the error and must log out and log back in.

**Currently applied to**: `DELETE /api/backup/purge` (5 minute max age), `DELETE /api/admin/users/:id` (5 minute max age), and `PATCH /api/admin/users/:id` when the request body includes a `password` field (5 minute max age) — inline-checked rather than as route middleware, since the same endpoint also handles non-sensitive fields (`name`, `username`) that don't require step-up auth.

---

## Static Assets Are Public

The Express `authenticate` middleware is mounted on the `/api` prefix only (`app.use('/api', authenticate)`). It never gates the SPA shell, JS/CSS bundles, or `manifest.json` — those are always served with no auth required. This is intentional: the browser cannot attach a Bearer token on plain page navigation, and the login page itself must be able to load before any token exists. Auth is enforced entirely client-side for page access (`ProtectedRoute` redirects to `/login` if no token is stored) and entirely server-side for data access (every `/api/*` route — except `/api/ping`, `/api/auth/login`, and `/api/auth/refresh` — requires a valid Bearer token).

---

## Permission Table

| Endpoint                         | Public | `user` (with babyId) |   `admin`    |
|----------------------------------|:------:|:--------------------:|:------------:|
| `POST /api/auth/login`           |   ✅    |          ✅           |      ✅       |
| `POST /api/auth/refresh`         |   ✅    |          ✅           |      ✅       |
| `POST /api/auth/logout`          |   —    |          ✅           |      ✅       |
| `GET /api/auth/me`               |   —    |          ✅           |      ✅       |
| `PATCH /api/auth/me`             |   —    |          ✅           |      ✅       |
| `GET /api/ping`                  |   ✅    |          ✅           |      ✅       |
| `GET /api/build-time`            |   —    |          ❌           |      ✅       |
| **Admin — babies**               |        |                      |              |
| `GET /api/admin/babies`          |   —    |          ❌           |      ✅       |
| `POST /api/admin/babies`         |   —    |          ❌           |      ✅       |
| `PUT /api/admin/babies/:id`      |   —    |          ❌           |      ✅       |
| `DELETE /api/admin/babies/:id`   |   —    |          ❌           |      ✅       |
| **Admin — users**                |        |                      |              |
| `GET /api/admin/users`           |   —    |          ❌           |      ✅       |
| `POST /api/admin/users`          |   —    |          ❌           |      ✅       |
| `PATCH /api/admin/users/:id`     |   —    |          ❌           |      ✅       |
| `DELETE /api/admin/users/:id`    |   —    |          ❌           |      ✅       |
| **Baby**                         |        |                      |              |
| `GET /api/baby`                  |   —    |     ✅ (own baby)     |      ❌       |
| `POST /api/baby/invite`          |   —    |     ✅ (own baby)     |      ❌       |
| **Backup**                       |        |                      |              |
| `GET /api/backup`                |   —    |          ❌           | ✅ (all data) |
| `POST /api/backup/restore`       |   —    |          ❌           |      ✅       |
| `DELETE /api/backup/purge`       |   —    |          ❌           | ✅ *(requires login within 5 min — see `requireRecentAuth`)* |
| **Served Milk**                  |        |                      |              |
| `GET /api/served-milk`           |   —    |   ✅ (baby-scoped)    |      ❌       |
| `GET /api/served-milk/total`     |   —    |   ✅ (baby-scoped)    |      ❌       |
| `GET /api/served-milk/:id`       |   —    |   ✅ (baby-scoped)    |      ❌       |
| `POST /api/served-milk`          |   —    |   ✅ (baby-scoped)    |      ❌       |
| `PUT /api/served-milk/:id`       |   —    |   ✅ (baby-scoped)    |      ❌       |
| `DELETE /api/served-milk/:id`    |   —    |   ✅ (baby-scoped)    |      ❌       |
| **Drank Milk**                   |        |                      |              |
| `GET /api/drank-milk`            |   —    |   ✅ (baby-scoped)    |      ❌       |
| `GET /api/drank-milk/latest`     |   —    |   ✅ (baby-scoped)    |      ❌       |
| `GET /api/drank-milk/suggested`  |   —    |   ✅ (baby-scoped)    |      ❌       |
| `GET /api/drank-milk/summary`    |   —    |   ✅ (baby-scoped)    |      ❌       |
| `GET /api/drank-milk/:id`        |   —    |   ✅ (baby-scoped)    |      ❌       |
| `POST /api/drank-milk`           |   —    |   ✅ (baby-scoped)    |      ❌       |
| `POST /api/drank-milk/waste`     |   —    |   ✅ (baby-scoped)    |      ❌       |
| `PUT /api/drank-milk/:id`        |   —    |   ✅ (baby-scoped)    |      ❌       |
| `DELETE /api/drank-milk/:id`     |   —    |   ✅ (baby-scoped)    |      ❌       |
| **Sleep**                        |        |                      |              |
| `GET /api/sleep`                 |   —    |   ✅ (baby-scoped)    |      ❌       |
| `GET /api/sleep/latest`          |   —    |   ✅ (baby-scoped)    |      ❌       |
| `GET /api/sleep/summary`         |   —    |   ✅ (baby-scoped)    |      ❌       |
| `GET /api/sleep/:id`             |   —    |   ✅ (baby-scoped)    |      ❌       |
| `POST /api/sleep`                |   —    |   ✅ (baby-scoped)    |      ❌       |
| `PUT /api/sleep/:id`             |   —    |   ✅ (baby-scoped)    |      ❌       |
| `DELETE /api/sleep/:id`          |   —    |   ✅ (baby-scoped)    |      ❌       |
| **Pee**                          |        |                      |              |
| `GET /api/pee`                   |   —    |   ✅ (baby-scoped)    |      ❌       |
| `GET /api/pee/:id`               |   —    |   ✅ (baby-scoped)    |      ❌       |
| `POST /api/pee`                  |   —    |   ✅ (baby-scoped)    |      ❌       |
| `PUT /api/pee/:id`               |   —    |   ✅ (baby-scoped)    |      ❌       |
| `DELETE /api/pee/:id`            |   —    |   ✅ (baby-scoped)    |      ❌       |
| **Poop**                         |        |                      |              |
| `GET /api/poop`                  |   —    |   ✅ (baby-scoped)    |      ❌       |
| `GET /api/poop/:id`              |   —    |   ✅ (baby-scoped)    |      ❌       |
| `POST /api/poop`                 |   —    |   ✅ (baby-scoped)    |      ❌       |
| `PUT /api/poop/:id`              |   —    |   ✅ (baby-scoped)    |      ❌       |
| `DELETE /api/poop/:id`           |   —    |   ✅ (baby-scoped)    |      ❌       |
| **Nappy (combined pee+poop)**    |        |                      |              |
| `GET /api/nappy/latest`          |   —    |   ✅ (baby-scoped)    |      ❌       |
| `GET /api/nappy/summary`         |   —    |   ✅ (baby-scoped)    |      ❌       |
| `GET /api/nappy/list`            |   —    |   ✅ (baby-scoped)    |      ❌       |
| **Medicine**                     |        |                      |              |
| `GET /api/medicine`              |   —    |   ✅ (baby-scoped)    |      ❌       |
| `GET /api/medicine/all`          |   —    |   ✅ (baby-scoped)    |      ❌       |
| `GET /api/medicine/logs`         |   —    |   ✅ (baby-scoped)    |      ❌       |
| `GET /api/medicine/logs/:id`     |   —    |   ✅ (baby-scoped)    |      ❌       |
| `GET /api/medicine/:id`          |   —    |   ✅ (baby-scoped)    |      ❌       |
| `POST /api/medicine`             |   —    |   ✅ (baby-scoped)    |      ❌       |
| `POST /api/medicine/:id/log`     |   —    |   ✅ (baby-scoped)    |      ❌       |
| `PUT /api/medicine/:id`          |   —    |   ✅ (baby-scoped)    |      ❌       |
| `PUT /api/medicine/logs/:id`     |   —    |   ✅ (baby-scoped)    |      ❌       |
| `PATCH /api/medicine/:id/active` |   —    |   ✅ (baby-scoped)    |      ❌       |
| `DELETE /api/medicine/:id`       |   —    |   ✅ (baby-scoped)    |      ❌       |
| `DELETE /api/medicine/logs/:id`  |   —    |   ✅ (baby-scoped)    |      ❌       |
| **Pumping**                      |        |                      |              |
| `GET /api/pumping`               |   —    |   ✅ (baby-scoped)    |      ❌       |
| `GET /api/pumping/latest`        |   —    |   ✅ (baby-scoped)    |      ❌       |
| `GET /api/pumping/summary`       |   —    |   ✅ (baby-scoped)    |      ❌       |
| `GET /api/pumping/:id`           |   —    |   ✅ (baby-scoped)    |      ❌       |
| `POST /api/pumping`              |   —    |   ✅ (baby-scoped)    |      ❌       |
| `PUT /api/pumping/:id`           |   —    |   ✅ (baby-scoped)    |      ❌       |
| `DELETE /api/pumping/:id`        |   —    |   ✅ (baby-scoped)    |      ❌       |
| **Predictions**                  |        |                      |              |
| `GET /api/predictions`           |   —    |   ✅ (baby-scoped)    |      ❌       |
| `GET /api/predictions/latest`    |   —    |   ✅ (baby-scoped)    |      ❌       |

**Legend**:
- ✅ — allowed
- ❌ — forbidden (`403 Forbidden`)
- — — requires authentication (`401` if no valid token)
- *baby-scoped* — rows are automatically filtered to the user's assigned baby; users can only see and modify their own baby's data

---

## Data Scoping

All data queries are automatically scoped by `baby_id`:

- **Reads**: every `SELECT` adds `WHERE baby_id = <user.babyId>`
- **Writes**: every `INSERT` injects `baby_id = <user.babyId>` and `created_by = <user.id>`
- **Mutations** (UPDATE/DELETE): conditions include `AND baby_id = <user.babyId>` — cross-baby tampering returns `404 Not Found`

Multiple users sharing the same baby (via invite) all see and modify the same data.

---

## Password Security

- Passwords are hashed with **bcrypt** using a randomly generated salt (included in the hash output)
- Default cost factor: **12 rounds** (configurable via `BCRYPT_ROUNDS` env var — higher = slower = more secure)
- Plain-text passwords are never stored or logged
- The `password_hash` column is **never returned** by any API endpoint

---

## Self-Service Account Management

Any authenticated user (regardless of role) can update their own **display name**, **username**, and **password** via `PATCH /api/auth/me` (see `doc/rest-api.md`):

- **Display name** / **username** — updated independently or together, no current-password check required. Usernames must be unique (`409 Conflict` if taken by another user).
- **Password** — requires both `currentPassword` (verified against the stored hash) and `newPassword` (min 8 characters). Prevents an attacker with a stolen but still-valid access token (e.g. from a shared device) from silently taking over the account.

Admins can additionally manage **any** user's username/password/display name/babyId via `PATCH /api/admin/users/:id` — no current-password check, since the admin is acting on someone else's account (see Permission Table above). The client's `AdminUsersPage` exposes this as an inline "✏️ edit name/username" and "🔒 set new password" action per user row.

---

## Admin Bootstrap

On every server startup `server/src/db.ts` runs after migrations and checks whether any admin user exists in the `users` table. If none is found:

1. If `SEED_ADMIN_USERNAME` and `SEED_ADMIN_PASSWORD` env vars are set → creates admin automatically
2. Otherwise → logs a warning to the console but continues starting up

This means the first admin must be created either via env vars at first boot, or by manually inserting a row into the `users` table with a bcrypt-hashed password and `role = 'admin'`.

Once an admin exists, new users and babies are created exclusively through `POST /api/admin/users` and `POST /api/admin/babies`.

---

## User ↔ Baby Relationship

```
babies ──< baby_users >── users
              │
         (many-to-many)
```

- A user has a **primary baby** stored in `users.baby_id` — this is the baby used for all data operations and embedded in the JWT
- `baby_users` is a join table that tracks which users can access which babies (used for the invite flow)
- When a user invites another user via `POST /api/baby/invite`, the invited user's `baby_id` is set to the inviter's baby (if not already set) and a `baby_users` row is inserted
- An admin has `baby_id = NULL` and is not present in `baby_users`

---

## Client-Side Auth (`client/src/utils/`)

### `authStore.ts`
Thin wrapper over `localStorage`:

| Method | Description |
|---|---|
| `getAccessToken()` | Returns stored access token or `null` |
| `getRefreshToken()` | Returns stored refresh token or `null` |
| `getUser()` | Returns parsed `TUser` (with `role`, `babyId`, etc.) or `null` |
| `setTokens(access, refresh, user?)` | Stores all three |
| `updateTokens(access, refresh)` | Updates tokens without touching user |
| `clear()` | Removes all auth keys from localStorage |
| `isAuthenticated()` | `true` if access token is present |

### `authFetch.ts`
Drop-in replacement for `fetch2` that handles auth automatically:

1. Reads access token from `authStore` and sets `Authorization: Bearer` header
2. On `401` response → calls `POST /api/auth/refresh` to get new tokens
3. On successful refresh → retries the original request once with the new token
4. On failed refresh → clears `authStore` and redirects to `/login`
5. Concurrent refresh requests are **queued** — only one refresh call is in flight at a time (prevents race conditions in multi-tab scenarios)

### `ProtectedRoute`
Wraps every app route in `App.tsx`. Redirects to `/login` if `authStore.isAuthenticated()` returns `false`.

### `NavBar` (role-aware)
The `NavBar` component reads `authStore.getUser()?.role` and renders different navigation items:
- **`user`** — baby-related items: Home, Pumping, Milk Drank, Sleep + menu with Poop & Pee, Medicine, Milk Saved, Settings
- **`admin`** — admin items only: Babies, Admin (hub), Users + menu with Settings
- **Hidden** entirely on the `/login` route

---

## Rate Limiting

`POST /api/auth/login` and `POST /api/auth/refresh` are throttled with `express-rate-limit` (keyed by IP): 10 requests / 15 minutes for `/login`, 60 requests / 15 minutes for `/refresh`. Exceeding the limit returns `429`. This mitigates scripted brute-force/credential-stuffing against the login endpoint.

---

## Security Notes

- **No sign-up endpoint** — only admins can create users; prevents unauthorised access
- **Refresh token rotation** — each refresh issues a new token and invalidates the old one; replay attacks are blocked
- **Token hash storage** — only a SHA-256 hash of the refresh token is stored in the DB; even a full DB leak cannot be used to forge new access tokens
- **Production secrets are mandatory** — `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must be set to long random strings in a `.env` file at the repo root (copy `.env.example`, loaded via `server/src/loadEnv.ts`/`dotenv`). If `NODE_ENV=production` and either is unset, the server **throws on startup** (`server/src/services/authService.ts`) instead of silently running on hardcoded dev defaults. Rotating the secrets (i.e. changing the values in `.env` and restarting) invalidates all existing sessions, forcing everyone to log in again.
- **Baby isolation** — all queries are hard-scoped by `baby_id`; horizontal privilege escalation between babies is not possible at the repository layer
- **Step-up auth for destructive actions** — `requireRecentAuth` requires a login within the last N minutes for actions like `DELETE /api/backup/purge`, `DELETE /api/admin/users/:id`, and admin-driven password resets (`PATCH /api/admin/users/:id` with `password`); a silent token refresh cannot satisfy this since `authTime` is only set at `/login`, never at `/refresh`
- **Rate limiting** — `/api/auth/login` and `/api/auth/refresh` are throttled (see above) to slow down brute-force attempts
- **Security headers & CORS** — `helmet` and `cors` are applied globally in `server/src/index.ts`; see `doc/server.md` for details (CSP is intentionally disabled, CORS defaults to same-origin-only via `ALLOWED_ORIGINS`)


