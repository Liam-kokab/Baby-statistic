# Database

## Engine
SQLite via `better-sqlite3` (synchronous API).

## File Location
```
data/baby.db    # at project root; auto-created on first startup; gitignored
```
Override with `DB_PATH` environment variable. In Docker, this resolves to `/app/data/baby.db` inside a named volume (`baby-statistic-data`) so it persists across rebuilds.

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

