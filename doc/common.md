# Common Package

## Package Name
`baby-statistic-common`

## Purpose
Holds TypeScript types and shared runtime utilities used across `client` and `server`. No build step required.

## File Structure
```
common/
  types/
    index.ts        # barrel re-export of all types
    servedMilk.ts   # served_milk types (TServedMilkDb, TServedMilk, TPostServedMilk)
    drankMilk.ts    # drank_milk types (TDrankMilkDb, TDrankMilk, TPostDrankMilk)
    sleep.ts        # sleep types (TSleepDb, TSleep, TPostSleep)
    pee.ts          # pee types (TPeeDb, TPee, TPostPee)
    poop.ts         # poop types (TPoopDb, TPoop, TPostPoop)
    TUtils.ts       # shared utility types (TDataOrError)
  util/
    index.ts      # barrel re-export of all utilities
    fetch.ts      # fetch2 — typed fetch wrapper
  package.json    # "types": "./types/index.ts", "exports" for subpaths
  tsconfig.json   # extends base, noEmit: true
```

## Importing
```ts
// types
import type { TServedMilk } from 'baby-statistic-common';
import type { TDataOrError } from 'baby-statistic-common';

// utilities
import { fetch2 } from 'baby-statistic-common/util';
```
Always use `import type` for type-only imports.

## Exported Types

Each DB table has its own type file with three types:
- `TXxxDb` — snake_case fields matching the DB row
- `TXxx` — camelCase fields for use in app/client code
- `TPostXxx` — `Omit<TXxx, 'id' | 'createdAt'>` for POST request bodies


### `servedMilk.ts`
| Type | Description |
|---|---|
| `TServedMilkStatus` | `'FRIDGE' \| 'FREEZER' \| 'USED' \| 'EXPIRED'` |
| `TServedMilkDb` | DB row — `id`, `amount`, `original_amount`, `status`, `expiry_date`, `created_at` |
| `TServedMilk` | App type — camelCase: `amount`, `originalAmount`, `status`, `expiryDate`, `createdAt` |
| `TPostServedMilk` | Internal type — `amount`, `originalAmount`, `status`, `expiryDate` (used by service/repository) |
| `TCreateServedMilk` | Client POST body — `amount`, `status` (other fields auto-computed) |
| `TServedMilkTotal` | `{ fridge: number; freezer: number; total: number }` — returned by `/api/served-milk/total` |

### `drankMilk.ts`
| Type | Description |
|---|---|
| `TDrankMilkSource` | `'FRIDGE' \| 'FREEZER' \| 'BOOB'` |
| `TDrankMilkDb` | DB row — snake_case fields |
| `TDrankMilk` | App type — camelCase fields including `source` |
| `TPostDrankMilk` | POST body — `amount`, `source`, `isNewBottle` (required boolean: `true` = new record, `false` = add to latest) |

### `sleep.ts`
| Type | Description |
|---|---|
| `TSleepDb` | DB row — snake_case fields |
| `TSleep` | App type — `start: string`, `end: string \| null`, `createdAt` |
| `TPostSleep` | POST body — `start`, `end` |

### `pee.ts`
| Type | Description |
|---|---|
| `TPeeDb` | DB row — snake_case fields |
| `TPee` | App type — `id`, `createdAt` |
| `TPostPee` | POST body — `{}` (no fields; timestamp created server-side) |

### `poop.ts`
| Type | Description |
|---|---|
| `TPoopDb` | DB row — snake_case fields |
| `TPoop` | App type — `id`, `createdAt` |
| `TPostPoop` | POST body — `{}` (no fields; timestamp created server-side) |

### `pumping.ts`
| Type | Description |
|---|---|
| `TPumpingDb` | DB row — snake_case fields |
| `TPumping` | App type — `id`, `createdAt` |
| `TPostPumping` | POST body — `{}` (no fields; timestamp created server-side) |

### `TUtils.ts`
| Type | Description |
|---|---|
| `TDataOrError<T>` | Tagged union: `{ ok: true; data: T }` \| `{ ok: false; error: string; responseCode?: number }` |

## Exported Utilities (`util/`)

### `fetch2<T>(url, options?): Promise<TDataOrError<T>>`
Typed wrapper around the browser `fetch` API. Returns `TDataOrError<T>` — never throws. Use in client code only.

```ts
import { fetch2 } from 'baby-statistic-common/util';
import type { TDataOrError, TServedMilk } from 'baby-statistic-common';

const result: TDataOrError<TServedMilk[]> = await fetch2<TServedMilk[]>('/api/served-milk');
if (result.ok) {
  console.log(result.data);
} else {
  console.error(result.error, result.responseCode);
}
```

## Adding New Types
1. Create or extend a file in `common/types/`
2. Re-export from `common/types/index.ts`
3. No build step — changes are immediately available to both packages

## Adding New Utilities
1. Create a file in `common/util/`
2. Re-export from `common/util/index.ts`
3. Client-side utilities may use browser APIs (`fetch`, `localStorage`, etc.); server-safe utilities must not

## Workspace Setup
- Listed in root `package.json` workspaces: `["common", "client", "server"]`
- Both `client/package.json` and `server/package.json` declare `"baby-statistic-common": "*"` in `dependencies`
- npm workspaces symlinks it into `node_modules/baby-statistic-common`

