# REST API

Base URL (dev): `http://localhost:3000`  
All endpoints are prefixed with `/api`.  
All responses are **JSON**. Errors return `{ "error": "..." }`.

---

## `GET /api/ping`

Health check endpoint.

**Handler**: `server/src/routes/ping.ts`

**Response `200`**: `{ "message": "pong" }`

---

## `GET /api/build-time`

Returns the server build timestamp.

**Handler**: `server/src/routes/buildTime.ts`

**Response `200`**:
```json
{ "buildTime": "2026-05-22T12:00:00.000Z" }
```

---

## `GET /api/backup`

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
  "pumping":       [ ...rows ]
}
```

---

## `POST /api/backup/restore`

Restores (upserts) rows into the DB. The body may omit any table or individual fields — missing tables are skipped, missing nullable fields default to `null`. A NOT NULL constraint violation returns `400`.

**Handler**: `server/src/routes/backup.ts`

**Request body**: same shape as `GET /api/backup` response (all keys optional).

**Response `200`**:
```json
{ "ok": true, "inserted": { "sleep": 5, "pee": 12 } }
```

**Response `400`**: `{ "error": "..." }`

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


