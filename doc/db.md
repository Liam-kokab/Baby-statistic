# Database

## Engine
SQLite via `better-sqlite3` (synchronous API).

## File Location
```
data/baby.db    # at project root; auto-created on first startup; gitignored
```
Override with `DB_PATH` environment variable.


## Singleton (`server/src/db.ts`)
Exports a single `db: Database.Database` instance. Importing `'./db'` initialises the database and runs all pending migrations. Never instantiate `new Database()` elsewhere.

A custom SQLite function `now_oslo()` is registered on the connection at startup via `db.function('now_oslo', ...)`. It returns the current Oslo local time as `YYYY-MM-DDTHH:MM:SS`.

## Pragmas
- `journal_mode = WAL` — better concurrent read performance
- `foreign_keys = ON` — enforces FK constraints

## Migration System (`server/src/migrations/index.ts`)
- Migrations are defined as `{ name: string; up: string }[]`
- Applied once, tracked in the `_migrations` table
- Names must be unique and lexicographically sortable (e.g., `001_initial`, `002_add_weight`)
- To add a migration: append an entry to the `migrations` array

```ts
{
  name: '002_add_weight',
  up: `ALTER TABLE served_milk ADD COLUMN weight INTEGER;`,
},
```

### Applied migrations
| Name | Description | Env |
|---|---|---|
| `001_schema` | Creates all tables with full schema + UTC triggers | all |
| `002_seed_test_data` | Inserts 7 days of randomised test data | **dev only** (`NODE_ENV !== 'production'`) |
| `003_oslo_triggers` | Drops and recreates all `AFTER UPDATE` triggers using `now_oslo()` | all |
| `004_clear_test_data` | Deletes all rows + resets auto-increment sequences | **production only** (`NODE_ENV === 'production'`) |
| `005_drank_milk_boob_source` | Recreates `drank_milk` table with `BOOB` added to the `source` CHECK constraint | all |
| `006_medicine` | Creates `medicine` and `medicine_log` tables | all |
| `007_drop_updated_at` | Drops all `updated_at` columns and their `AFTER UPDATE` triggers from every table | all |
| `008b_fix_primary_keys` | Recreates all tables with proper `INTEGER PRIMARY KEY AUTOINCREMENT` | all |
| `009_pumping` | Creates `pumping` table | all |
| `010_simplify_medicine` | Drops `interval_hours` and `start_time` from `medicine` — each medicine is now taken once per calendar day | all |
| `011_prediction_logs` | Creates `prediction_log` table (v1) | all |
| `012_prediction_logs_v2` | Drops and recreates `prediction_log` with rolling-window debug columns | all |
| `013_medicine_is_active_ensure` | Ensures `is_active` is not NULL in `medicine` | all |
| `014_auth` | Creates `babies`, `users`, `baby_users`, and `refresh_tokens` tables | all |
| `015_add_baby_and_user_cols` | Inserts default baby (id=1), adds `baby_id` + `created_by` to all data tables | all |

`002_seed_test_data` and `004_clear_test_data` are conditionally included in the migrations array based on `process.env.NODE_ENV`, so they never cross-pollute environments.

## Schema


### `served_milk`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | autoincrement |
| `amount` | INTEGER | current ml remaining |
| `original_amount` | INTEGER | ml at time of recording |
| `status` | TEXT | `FRIDGE` \| `FREEZER` \| `USED` \| `EXPIRED` |
| `expiry_date` | TEXT \| NULL | ISO datetime; auto-set on insert (FRIDGE +4 days, FREEZER +6 months) |
| `created_at` | TEXT | Oslo local datetime |

### `drank_milk`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | autoincrement |
| `amount` | INTEGER | ml consumed |
| `source` | TEXT | `FRIDGE` \| `FREEZER` \| `BOOB` |
| `created_at` | TEXT | Oslo local datetime |

### `sleep`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | autoincrement |
| `start` | TEXT | ISO datetime |
| `end` | TEXT \| NULL | ISO datetime, null if ongoing |
| `created_at` | TEXT | Oslo local datetime |

### `pee`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | autoincrement |
| `created_at` | TEXT | Oslo local datetime |

### `poop`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | autoincrement |
| `created_at` | TEXT | Oslo local datetime |

### `_migrations`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | autoincrement |
| `name` | TEXT UNIQUE | migration name |
| `applied_at` | TEXT | `datetime('now')` at apply time |

### `medicine` (migration `006_medicine`, simplified in `010_simplify_medicine`)
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | autoincrement |
| `name` | TEXT | medicine name |
| `is_active` | INTEGER | 1 = active, 0 = soft-deleted |
| `created_at` | TEXT | Oslo local datetime |

### `medicine_log` (migration `006_medicine`)
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | autoincrement |
| `medicine_id` | INTEGER | references `medicine.id` (no cascade — logs are permanent) |
| `taken_at` | TEXT | Oslo local datetime when dose was taken |
| `created_at` | TEXT | Oslo local datetime |

### `pumping` (migration `009_pumping`)
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | autoincrement |
| `created_at` | TEXT | Oslo local datetime |

### `prediction_log` (migration `011_prediction_logs`)
| Column             | Type            | Notes                                                                                                                                                                                                                             |
|--------------------|-----------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `id`               | INTEGER PK      | autoincrement                                                                                                                                                                                                                     |
| `predicted_amount` | INTEGER         | Suggested ml recorded at the time a new stored-bottle was created                                                                                                                                                                 |
| `actual_id`        | INTEGER \| NULL | When available, links to `drank_milk.id` for the matching actual drink; many predictions may be unlinked until the corresponding `drank_milk` is inserted and the prediction row is updated. API returns only linked predictions. |
| `raw_prediction`   | REAL \| NULL    | Internal raw (unrounded) predicted value captured for diagnostics/tuning                                                                                                                                                          |
| `observed_max`     | INTEGER \| NULL | Observed historical single-bottle max used by the shrink step                                                                                                                                                                     |
| `recency_factor`   | REAL \| NULL    | Recency scaling factor applied when the prediction was generated                                                                                                                                                                  |
| `rounding_step`    | INTEGER \| NULL | Rounding step used (e.g. 10 ml)                                                                                                                                                                                                   |

Notes:
- The `prediction_log` intentionally does NOT include its own `created_at`; when a prediction is linked to an actual drink the server uses the linked `drank_milk.created_at` as the canonical `createdAt` for reporting and filtering. `GET /api/predictions` returns only linked predictions and exposes the linked drink timestamp as the prediction `createdAt`.

## Triggers
`updated_at` columns and their `AFTER UPDATE` triggers were removed in migration `007_drop_updated_at`. No triggers remain on data tables.

## Timezone Handling
All server-generated timestamps (`created_at`, and sleep `start`/`end`) are stored as **Oslo local time** in the format `YYYY-MM-DDTHH:MM:SS` (no UTC offset). The utility `server/src/utils/time.ts` provides:

| Function | Description |
|---|---|
| `nowOslo()` | Current Oslo local time as `YYYY-MM-DDTHH:MM:SS` (for DB storage) |
| `toOsloLocal(str)` | Converts any ISO string (with/without offset) to Oslo local `YYYY-MM-DDTHH:MM:SS` |
| `toOsloIso(str)` | Converts a stored Oslo local string to a full ISO 8601 string with offset (e.g. `+01:00` / `+02:00`) for API responses |
| `toOsloIsoNullable(str)` | Nullable variant of `toOsloIso` |

All `fromDb()` functions in repositories call `toOsloIso()` on timestamps before returning them to callers.

## Auth Tables (migration `014_auth`)
> See [`doc/auth.md`](./auth.md) for the full authentication architecture, permission table, and security notes.

### `babies`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | autoincrement |
| `name` | TEXT | display name of the baby |
| `created_at` | TEXT | Oslo local datetime |

### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | autoincrement |
| `username` | TEXT UNIQUE | login identifier |
| `password_hash` | TEXT | bcrypt hash (12 rounds by default) |
| `role` | TEXT | `user` \| `admin` |
| `baby_id` | INTEGER \| NULL | FK → `babies.id`; NULL for admins |
| `config` | TEXT | JSON string (default `{}`); reserved for future per-user config |
| `created_at` | TEXT | Oslo local datetime |

### `baby_users`
Join table — many users per baby.
| Column | Type | Notes |
|---|---|---|
| `user_id` | INTEGER PK | FK → `users.id` ON DELETE CASCADE |
| `baby_id` | INTEGER PK | FK → `babies.id` ON DELETE CASCADE |

### `refresh_tokens`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | autoincrement |
| `user_id` | INTEGER | FK → `users.id` ON DELETE CASCADE |
| `token_hash` | TEXT UNIQUE | SHA-256 hash of the raw refresh token |
| `expires_at` | TEXT | UTC datetime of expiry (7 days from issue) |
| `created_at` | TEXT | Oslo local datetime |

## Data table extensions (migration `015_add_baby_and_user_cols`)
Every data table (`served_milk`, `drank_milk`, `sleep`, `pee`, `poop`, `medicine`, `medicine_log`, `pumping`, `prediction_log`) gains two columns:
| Column | Type | Notes |
|---|---|---|
| `baby_id` | INTEGER NOT NULL DEFAULT 1 | Which baby this record belongs to |
| `created_by` | INTEGER NOT NULL DEFAULT 0 | Which user created this record |

Existing data is automatically assigned to the default baby (id=1, name="Default Baby") created by the same migration.

## Admin Seed
On every startup, `server/src/db.ts` checks whether an admin user exists. If none is found and `SEED_ADMIN_USERNAME` + `SEED_ADMIN_PASSWORD` env vars are set, an admin is created automatically. If the env vars are missing a warning is printed but startup continues normally.
