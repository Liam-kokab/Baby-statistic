# REST API

Base URL (dev): `http://localhost:3000`  
All endpoints are prefixed with `/api`.  
All responses are **JSON**. Errors return `{ "error": "..." }`.

**Authentication**: All endpoints except `POST /api/auth/login`, `POST /api/auth/refresh`, and `GET /api/ping` require `Authorization: Bearer <accessToken>` header. Unauthenticated requests return `401`.

**`X-Ws-Client-Id` header** (optional): the client sends a random per-tab UUID on every request (see "Live Updates (WebSocket)" below). On mutating requests (`POST`/`PUT`/`PATCH`/`DELETE`) it's used to suppress the resulting WebSocket "update" notification for the exact tab that made the request, since it already has fresh data from the response. Non-browser API clients (Swagger UI, `curl`, the MCP server) can omit it — every connected client still gets notified normally.

**Rate limiting**: `POST /api/auth/login` (10 requests / 15 min per IP) and `POST /api/auth/refresh` (60 requests / 15 min per IP) are throttled via `express-rate-limit`. Exceeding the limit returns `429` with `{ "error": "Too many ... attempts. Please try again later." }`.

See [`doc/auth.md`](./auth.md) for the full permission table, token architecture, and security details.

---

## Live Updates (WebSocket)

### `GET /ws` (upgrade)
Not a REST endpoint — a WebSocket upgrade at `/ws` (outside `/api`), used to push "this baby's data changed" notifications so clients can refetch instead of polling. See `doc/client.md` → "Live Updates (WebSocket)" and `doc/server.md` → "Live Updates (WebSocket)" for full details.

**Auth**: the connection is accepted unauthenticated, then the client must send `{ "type": "auth", "token": "<accessToken>", "clientId"?: "<uuid>" }` as its first WebSocket message within 5 seconds — deliberately not a `?token=` query param, since query strings end up in nginx/proxy access logs and browser devtools/history. The server verifies the token and scopes the connection to that token's `babyId`, replying `{ "type": "auth-ok" }` on success. A connection that doesn't authenticate in time, sends an invalid token, or has no `babyId`, is closed.

The optional `clientId` is a random per-tab ID the client generates once and also sends as the `X-Ws-Client-Id` header on mutating REST requests. If a request that triggers an update carries the same `clientId` as this connection (i.e. this exact tab caused the change), the server skips sending that particular `update` notification to it — the tab already has fresh data from its own request's response. Every other connection (other tabs, other devices, even other devices logged in as the same username) is still notified. The server also keeps at most one live connection per `clientId` — if a tab reconnects (e.g. after being backgrounded) before its old socket ever sent a close frame, the new connection immediately replaces the stale one rather than leaving it to linger until the next heartbeat.

**Messages sent by the client**: `{ "type": "auth", "token": "<accessToken>", "clientId"?: "<uuid>" }` as the first message only (see Auth above).

**Messages sent to the client**: `{ "type": "auth-ok" }` once authenticated, then `{ "type": "update" }` whenever a mutating request (`POST`/`PUT`/`PATCH`/`DELETE`) succeeds for that baby — no other payload is ever sent.

---

## Auth

### `POST /api/auth/login`
Login with username + password.

**Body**: `{ "username": "...", "password": "..." }`

**Response `200`**: `{ "accessToken": "...", "refreshToken": "...", "user": { id, username, role, babyId, config, createdAt } }`

**Response `401`**: Invalid credentials.

---

### `POST /api/auth/refresh`
Exchange a valid refresh token for a new access token + rotated refresh token.

**Body**: `{ "refreshToken": "..." }`

**Response `200`**: `{ "accessToken": "...", "refreshToken": "..." }`

---

### `POST /api/auth/logout`
Invalidate the current refresh token. Requires Bearer token.

**Body**: `{ "refreshToken": "..." }`

**Response `204`**: No content.

---

### `GET /api/auth/me`
Return the currently authenticated user's public profile.

**Response `200`**: `TUser` object.

---

### `PATCH /api/auth/me`
Update the current user's own display name, username, and/or password. Requires Bearer token.

**Body**: `{ "name"?: "...", "username"?: "...", "currentPassword"?: "...", "newPassword"?: "..." }`
- `name` / `username` can be updated independently or together.
- To change the password, both `currentPassword` (must match the user's existing password) and `newPassword` (min 8 characters) are required.
- At least one field must be provided.

**Response `200`**: Updated `TUser` object.

**Response `400`**: Missing/invalid fields, or `newPassword` too short.

**Response `403`**: `currentPassword` does not match.

**Response `409`**: `username` already taken by another user.

---

## Admin *(requires `role: "admin"`)*

### `GET /api/admin/babies`
List all babies.

### `POST /api/admin/babies`
Create a baby. **Body**: `{ "name": "..." }`

### `PUT /api/admin/babies/:id`
Update a baby's name. **Body**: `{ "name": "..." }`

### `DELETE /api/admin/babies/:id`
Delete a baby.

---

### `GET /api/admin/users`
List all users (passwords excluded).

### `POST /api/admin/users`
Create a user. **Body**: `{ "username": "...", "password": "...", "role": "user"|"admin", "babyId": 1, "name"?: "..." }`

### `PATCH /api/admin/users/:id`
Update a user's username, password, babyId, and/or display name — no current-password check (admin override). **Body**: `{ "username"?: "...", "password"?: "...", "babyId"?: 1, "name"?: "..." }`

**Response `409`**: `username` already taken by another user.

**Response `403`** *(only when `password` is provided and the caller's login is stale — see `requireRecentAuth`)*: `{ "error": "Setting a user's password requires a recent login (within 300s)...", "code": "REAUTH_REQUIRED" }`

### `DELETE /api/admin/users/:id` *(requires recent login)*
Delete a user. Guarded by `requireRecentAuth(300)` — same 403/`REAUTH_REQUIRED` behavior as `DELETE /api/backup/purge` (see `doc/auth.md`).

---


## Baby *(requires `role: "user"` with a babyId)*

### `GET /api/baby`
Return the current user's baby info and co-users.

**Response `200`**: `{ "baby": TBaby, "users": TUser[] }`

### `POST /api/baby/invite`
Invite another user (by username) to share the current user's baby.

**Body**: `{ "username": "..." }`

**Response `201`**: `{ "ok": true }`

---

## `GET /api/ping`

Health check endpoint.

**Handler**: `server/src/routes/ping.ts`

**Response `200`**: `{ "message": "pong" }`

---

## `GET /api/build-time` *(admin only)*

Returns the server build timestamp.

**Handler**: `server/src/routes/buildTime.ts`

**Response `200`**:
```json
{ "buildTime": "2026-05-22T12:00:00.000Z" }
```

---

## `GET /api/backup` *(admin only)*

Returns all rows from every data table as a full DB dump.

**Handler**: `server/src/routes/backup.ts`

**Response `200`**:
```jsonc
{
  "served_milk":   [ ...rows ],
  "drank_milk":    [ ...rows ],
  "sleep":         [ ...rows ],
  "pee":           [ ...rows ],
  "poop":          [ ...rows ],
  "medicine":      [ ...rows ],
  "medicine_log":  [ ...rows ],
  "pumping":       [ ...rows ],
  "milestone":     [ ...rows ]
}
```

---

## `POST /api/backup/restore` *(admin only)*

Restores (upserts) rows into the DB. The body may omit any table or individual fields — missing tables are skipped, missing nullable fields default to `null`. A NOT NULL constraint violation returns `400`.

**Handler**: `server/src/routes/backup.ts`

**Body size limit**: `20mb` (this route parses its own JSON body with a raised limit — all other routes are limited to Express's default `100kb`, since a full-database dump can exceed that).

**Request body**: same shape as `GET /api/backup` response (all keys optional).

**Response `200`**:
```json
{ "ok": true, "inserted": { "sleep": 5, "pee": 12 } }
```

**Response `400`**: `{ "error": "..." }`

---

## `DELETE /api/backup/purge` *(admin only, requires recent login)*

Irreversibly deletes **all rows from every data table** (`served_milk`, `drank_milk`, `sleep`, `pee`, `poop`, `medicine`, `medicine_log`, `pumping`, `milestone`, `prediction_log`) across **all babies**, and resets their auto-increment sequences. Does **not** touch `babies`, `users`, `baby_users`, or `refresh_tokens` — accounts and baby records survive a purge.

**Handler**: `server/src/routes/backup.ts`

**Guards**:
1. `requireAdmin` — caller must be an admin.
2. `requireRecentAuth(300)` — the access token's `authTime` (set only at `/api/auth/login`, never renewed by `/api/auth/refresh`) must be **≤ 5 minutes old**. A silent token refresh does not reset this — the admin must actually log out and log back in shortly before calling this endpoint. See `doc/auth.md`.
3. Body safeguard (below).

**Request body** (required safeguard — request is rejected without it):
```json
{ "confirm": "PURGE" }
```

**Response `200`**:
```json
{ "ok": true, "deleted": { "served_milk": 12, "drank_milk": 40, "sleep": 20, "pee": 15, "poop": 10, "medicine": 2, "medicine_log": 30, "pumping": 8, "milestone": 3, "prediction_log": 40, "users": 3, "babies": 2 } }
```

**Response `400`**: `{ "error": "Refusing to purge: send { \"confirm\": \"PURGE\" } in the request body." }`

**Response `403`** *(stale login)*:
```json
{ "error": "This action requires a recent login (within 300s). Please log out and log back in, then try again.", "code": "REAUTH_REQUIRED" }
```

---


## Served Milk — `/api/served-milk`

| Method | Path | Description |
|---|---|---|
| GET | `/api/served-milk` | List all |
| GET | `/api/served-milk/total` | Get fridge/freezer totals (no time filter) |
| GET | `/api/served-milk/:id` | Get one |
| POST | `/api/served-milk` | Create |
| PUT | `/api/served-milk/:id` | Update |
| DELETE | `/api/served-milk/:id` | Delete |

**GET query params**: `from`, `to` (ISO datetime, filter on `created_at`)

**GET `/total` response**: `{ "fridge": 1200, "freezer": 800, "total": 2000 }` — sums `amount` for all `FRIDGE` and `FREEZER` records only.

**POST body**: `{ "amount": 80, "status": "FRIDGE" | "FREEZER" }`  
- `status` on create must be `FRIDGE` or `FREEZER` — `USED`/`EXPIRED` are not allowed
- `expiryDate` is auto-calculated: FRIDGE → +4 days, FREEZER → +6 months
- `originalAmount` is auto-set to `amount`

**PUT body**: any subset of `{ "amount", "status", "originalAmount", "expiryDate", "createdAt" }`  
- Returns `409` if the record is already `USED` or `EXPIRED` (terminal states)

**Status lifecycle**: `FRIDGE` / `FREEZER` → `USED` (consumed) or `EXPIRED` (past expiry date)  
After every insert or update, all overdue `FRIDGE`/`FREEZER` records are automatically flipped to `EXPIRED`.

---

## Drank Milk — `/api/drank-milk`

| Method | Path | Description |
|---|---|---|
| GET | `/api/drank-milk` | List all |
| GET | `/api/drank-milk/:id` | Get one |
| GET | `/api/drank-milk/summary` | Total/avg-per-day ml over a date range |
| GET | `/api/drank-milk/today-stats` | Today's ml so far vs the last-10-days average |
| | GET | `/api/drank-milk/suggested` | Suggest next bottle amount |
| POST | `/api/drank-milk` | Create (also deducts from stored milk) |
| POST | `/api/drank-milk/waste` | Subtract waste from the latest record (does **not** touch storage) |
| PUT | `/api/drank-milk/:id` | Update |
| DELETE | `/api/drank-milk/:id` | Delete |

**GET query params**: `from`, `to` (ISO datetime, filter on `created_at`)

**POST body**: `{ "amount": 60, "source": "FRIDGE" | "FREEZER" | "BOOB", "isNewBottle": true }` — `isNewBottle` is required: `true` creates a new record; `false` adds the amount to the latest existing record. For `FRIDGE`/`FREEZER`, also deducts `amount` from the oldest matching `served_milk` records. `BOOB` does **not** deduct from storage.

**POST `/waste` body**: `{ "amount": 10 }` — subtracts `amount` from the latest `drank_milk` record whose source is `FRIDGE` or `FREEZER` (floored at 0). `BOOB` records are skipped. Returns `404` if no matching drank records exist. Does **not** restore milk to storage.

**PUT body**: `{ "amount": 60, "source": "FRIDGE" | "FREEZER" | "BOOB", "createdAt": "..." }` (partial)

**GET `/suggested` response**: `{ "nextDrinkAmount": 60 }` — suggested millilitres for the next bottle. Uses server-side settings (no query params).

**GET `/today-stats` response** (`TDrankMilkTodayStats`): `{ "todayMl": 320, "avgPerDayLast10": 280, "hasBoob": false }` — `todayMl` is the total drunk so far today (Oslo local date); `avgPerDayLast10` is the average ml/day over the 10 calendar days before today, divided only by the days in that window that actually have a record. Powers the Milk Drank page's item-view stat chip (`{today}/{avg}`) and the always-on-display `todayMilk` field.

---

## Predictions — `/api/predictions`

| Method | Path | Description |
|---|---|---|
| GET | `/api/predictions` | List stored prediction logs (optional `from`/`to` query) |
| GET | `/api/predictions/latest` | Get the most recent stored prediction |

**GET query params**: `from`, `to` (ISO datetime).

Notes:
- The server stores the current prediction (the value returned by `/api/drank-milk/suggested`) in `prediction_log` each time a new stored-bottle record is created (`POST /api/drank-milk` with `isNewBottle = true` and `source` = `FRIDGE` or `FREEZER`). `BOOB` records are not logged or linked.
- `GET /api/predictions` returns only predictions that have been linked to an actual `drank_milk` record (i.e. `actual_id IS NOT NULL`).
- When filtering with `from`/`to`, the filter applies to the *linked* drink timestamp — the server uses the linked `drank_milk.created_at` as the canonical `createdAt` for a prediction when present.
- Each returned prediction item includes optional debug fields recorded at prediction time: `rawPrediction`, `observedMax`, `recencyFactor`, and `roundingStep`.


## Sleep — `/api/sleep`

| Method | Path | Description |
|---|---|---|
| GET | `/api/sleep` | List all |
| GET | `/api/sleep/latest` | Get the most recent sleep record (`null` if none) |
| GET | `/api/sleep/:id` | Get one |
| POST | `/api/sleep` | Create |
| PUT | `/api/sleep/:id` | Update |
| DELETE | `/api/sleep/:id` | Delete |

**GET `/latest` response**: the single most-recent `TSleep` object ordered by `start DESC`, or `null` if no records exist.

**GET query params**: `from`, `to` (ISO datetime, filter on `created_at`)

**POST body**: `{ "start": "2026-04-13T22:00:00", "end": null }`  
**PUT body**: `{ "end": "2026-04-14T06:00:00" }` (partial)

---

## Pee — `/api/pee`

| Method | Path | Description |
|---|---|---|
| GET | `/api/pee` | List all |
| GET | `/api/pee/:id` | Get one |
| POST | `/api/pee` | Log a pee event (no body) |
| PUT | `/api/pee/:id` | Update event timestamp |
| DELETE | `/api/pee/:id` | Delete |

**GET query params**: `from`, `to` (ISO datetime, filter on `created_at`)

**PUT body**: `{ "createdAt": "2026-04-14T12:00:00" }` (optional — updates event timestamp)

---

## Poop — `/api/poop`

| Method | Path | Description |
|---|---|---|
| GET | `/api/poop` | List all |
| GET | `/api/poop/:id` | Get one |
| POST | `/api/poop` | Log a poop event (no body) |
| PUT | `/api/poop/:id` | Update event timestamp |
| DELETE | `/api/poop/:id` | Delete |

**GET query params**: `from`, `to` (ISO datetime, filter on `created_at`)

**PUT body**: `{ "createdAt": "2026-04-14T12:00:00" }` (optional — updates event timestamp)

---

## Error responses

| Status | Body | Meaning |
|---|---|---|
| `400` | `{ "error": "Missing required fields: ..." }` | Invalid / missing request body |
| `404` | `{ "error": "Not found" }` | Record does not exist |
| `409` | `{ "error": "Cannot update milk with status ..." }` | Attempt to update a terminal record (USED/EXPIRED) |
| `204` | *(no body)* | Successful delete (no content) |

---

## `GET /api/medicine`

Returns all active medicines with their latest log timestamp.

**Response `200`**: `TMedicineWithLatestLog[]`

---

## `GET /api/medicine/all`

Returns all medicines (active and inactive).

**Response `200`**: `TMedicine[]`

---

## `POST /api/medicine`

Creates a new medicine.

**Body**: `{ "name": "Vitamin D" }`

**Response `201`**: `TMedicine`

---

## `PUT /api/medicine/:id`

Updates the medicine name.

**Body**: `{ "name": "Vitamin D" }`

**Response `200`**: `TMedicine`

---

## `PATCH /api/medicine/:id/active`

Sets the active state of a medicine.

**Body**: `{ "isActive": true }`

**Response `200`**: `TMedicine`

---

## `DELETE /api/medicine/:id`

Soft-deletes a medicine (sets `is_active = 0`). Logs are retained.

**Response `204`**: *(no body)*

---

## `GET /api/medicine/logs`

Returns all medicine log entries within an optional date range.

**Query params**: `from`, `to` — ISO datetime strings

**Response `200`**: `TMedicineLog[]`

---

## `POST /api/medicine/:id/log`

Records a dose taken for medicine `:id`.

**Body**: `{ "takenAt": "2026-04-19T08:00:00" }` *(optional — defaults to now)*

**Response `201`**: `TMedicineLog`

---

## `GET /api/pumping/latest`

Returns the most recent pumping entry, or `null` if none exists.

**Handler**: `server/src/routes/pumping.ts`

**Response `200`**: `TPumping | null`

---

## `GET /api/pumping`

Returns all pumping entries within an optional date range.

**Handler**: `server/src/routes/pumping.ts`

**Query params**: `from`, `to` — ISO datetime strings

**Response `200`**: `TPumping[]`

---

## `POST /api/pumping`

Logs a new pumping event (timestamp = now).

**Handler**: `server/src/routes/pumping.ts`

**Response `201`**: `TPumping`

---

## Milestones — `/api/milestones`

| Method | Path | Description |
|---|---|---|
| GET | `/api/milestones` | List all (optional `from`/`to` query, filters on `occurredAt`) |
| GET | `/api/milestones/:id` | Get one |
| POST | `/api/milestones` | Create |
| PUT | `/api/milestones/:id` | Update |
| DELETE | `/api/milestones/:id` | Delete |

**Handler**: `server/src/routes/milestone.ts`

**GET query params**: `from`, `to` (ISO date `YYYY-MM-DD`, filter on `occurredAt`)

**POST body**: `{ "title": "First steps", "description"?: "...", "occurredAt"?: "2026-07-27" }` — `occurredAt` defaults to today's date if omitted.

**PUT body**: `{ "title"?: "...", "description"?: "..." | null, "occurredAt"?: "YYYY-MM-DD" }` (partial update)

**Response `200`/`201`**: `TMilestone`

**Response `400`**: `{ "error": "title is required" }` (create) or `{ "error": "title cannot be empty" }` (update)

**Response `404`**: `{ "error": "Not found" }`

---

## Home — `/api/home`

Aggregated read-only endpoints so the client doesn't have to fan out several requests. Both require `role: "user"` with a `babyId`.

### `GET /api/home/summary`

Everything the Home page needs for its first load and every subsequent update (initial mount, tab-visible/stale refetch, and after any action) — combines what used to be six separate calls (`sleep/latest`, `drank-milk/latest`, `drank-milk/suggested`, `pumping/latest`, `nappy/latest`, `medicine`).

**Handler**: `server/src/routes/home.ts` / `server/src/services/homeService.ts`

**Response `200`** (`THomeSummary`):
```json
{
  "latestSleep": { "id": 1, "start": "...", "end": null, "createdAt": "..." },
  "latestDrank": { "id": 1, "amount": 60, "source": "FRIDGE", "createdAt": "..." },
  "suggestedAmount": 80,
  "latestPumping": { "id": 1, "createdAt": "..." },
  "latestNappy": { "createdAt": "..." },
  "medicines": [ { "id": 1, "name": "Vitamin D", "latestTakenAt": "..." } ]
}
```
Each field may be `null`/`[]` when no matching records exist yet.

---

## App Events — `/api/app-events`

Generic single-row-per-`id` app-level status store. Currently only used for backup-success reporting.

### `GET /api/app-events/backup`

Returns the last successful backup timestamp. Available to any authenticated user (admin or baby user) — used to drive the `BackupStatusDot` client component.

**Handler**: `server/src/routes/appEvents.ts`

**Response `200`**:
```json
{ "lastBackupAt": "2026-08-12T06:00:00+02:00" }
```
`lastBackupAt` is `null` if no successful backup has ever been reported.

---

### `POST /api/app-events/backup` *(admin only)*

Reports that a backup completed successfully (called by `backup-lambda` after verifying the uploaded S3 object's size is > 0). Upserts the single `app_events` row with `id = 'BACKUP'`.

**Handler**: `server/src/routes/appEvents.ts`

**Body**: `{ "timestamp"?: "2026-08-12T06:00:00.000Z" }` *(optional — defaults to now)*

**Response `201`**:
```json
{ "lastBackupAt": "2026-08-12T06:00:00+02:00" }
```

---

### `GET /api/home/always-on-display`

Lightweight subset used to refresh the "always on display" black-screen readout, shown on **every** page (not just Home). The client fetches this once when the black screen opens, and again every 5 minutes while it stays open.

**Handler**: `server/src/routes/home.ts` / `server/src/services/homeService.ts`

**Response `200`** (`TAlwaysOnDisplayData`):
```json
{
  "latestSleep": { "id": 1, "start": "...", "end": null, "createdAt": "..." },
  "latestPumping": { "id": 1, "createdAt": "..." },
  "latestDrank": { "id": 1, "amount": 60, "source": "FRIDGE", "createdAt": "..." },
  "drankToday": { "todayMl": 320, "avgPerDayLast10": 280, "hasBoob": false },
  "medicines": [ { "id": 1, "name": "Vitamin D", "isActive": true, "createdAt": "...", "latestTakenAt": "..." } ]
}
```


