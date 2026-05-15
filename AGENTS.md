## Project Overview
Baby statistics tracker — logs milk, sleep, pee, and poop events for a baby.

## Architecture
npm workspaces monorepo with three packages:
- **`common/`** — shared TypeScript types only (`baby-statistic-common`); no build step
- **`client/`** — React 19, Vite, TypeScript, CSS Modules, emoji icons
- **`server/`** — Express 5, TypeScript, `better-sqlite3` (SQLite)

Production: Express serves the Vite-built client from `server/public` (static files).

## Dev Workflow
```
npm run dev          # starts client + server concurrently (cyan = client, yellow = server)
npm run dev:client   # Vite dev server only (port 5173)
npm run dev:server   # nodemon + ts-node server only (port 3000)
npm run build        # tsc + vite build for both packages
```
Vite proxies all `/api/*` requests to `http://localhost:3000` in dev (`client/vite.config.ts`).

## Server Patterns

### Adding a route
1. Create `server/src/routes/<name>.ts` — instantiate `Router()`, export default.
2. Import `db` from `'../db'` to query SQLite.
3. Mount in `server/src/index.ts` under `app.use('/api/<name>', ...)`.

```ts
// server/src/routes/example.ts
import { Router } from 'express';
import type { Request, Response } from 'express';
import { db } from '../db';

const router = Router();

router.get('/', (_req: Request, res: Response): void => {
  const rows = db.prepare('SELECT * FROM served_milk').all();
  res.json(rows);
});

export default router;
```

### Database singleton
`server/src/db.ts` exports a single `db: Database.Database` instance. Migrations run automatically on `import './db'` (already done in `index.ts`). Never create a second `Database` instance.

### Adding a migration
Append an entry to the `migrations` array in `server/src/migrations/index.ts`. Names must be unique and sortable (e.g., `'002_add_weight'`). Migrations apply once and are tracked in the `_migrations` table.

### DB schema (migration `001_schema`)
| Table | Key columns |
|---|---|
| `served_milk` | `amount`, `original_amount`, `status` (`FRIDGE`\|`FREEZER`\|`USED`\|`EXPIRED`), `expiry_date` |
| `drank_milk` | `amount`, `source` (`FRIDGE`\|`FREEZER`\|`BOOB`) |
| `sleep` | `start` (TEXT), `end` (TEXT, nullable) |
| `pee` | timestamps only |
| `poop` | timestamps only |

All tables have `created_at` / `updated_at` (TEXT, ISO datetime) managed by `AFTER UPDATE` triggers. `_migrations` tracks applied migrations.

## Client Patterns

### API calls
Always use `fetch2` from `baby-statistic-common/util` for API calls — it handles status checks, JSON parsing, and error cases, returning `TDataOrError<T>` without requiring try/catch in components:
```ts
import { fetch2 } from 'baby-statistic-common/util';
import type { TServedMilk } from 'baby-statistic-common';

const result = await fetch2<TServedMilk[]>('/api/served-milk');
if (result.ok) {
  setMilk(result.data);
} else {
  setError(result.error); // result.responseCode also available
}
```
Do **not** use raw `fetch` + try/catch for API calls when `fetch2` covers the use case.

### Type guards
Only write inline type guards when consuming responses that bypass `fetch2` (e.g., third-party APIs). `fetch2` already returns a typed `TDataOrError<T>` — no guard needed on top of it.

### Styling
Each component has a co-located `.module.css` file (e.g., `App.module.css`). Import as `import styles from './Component.module.css'` and reference via `styles.className`. No inline styles.

All design tokens (colours, radii, shadows, spacing) are CSS custom properties defined in `client/src/styles/variables.css` on `:root`. They are loaded globally via `global.css` → `main.tsx`, so every module CSS file can use them directly with `var()` — **no import needed**:
```css
.myClass {
  color: var(--color-primary);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}
```
Do **not** use Sass/SCSS — the project uses plain CSS only.

### Icons
Use plain emoji characters for all icons. Pass them via the `emoji` prop on the `Button` component, or render them directly as text. Do **not** use FontAwesome or any icon library.

## Shared Types (`common/`)
`common/types/` holds domain types shared between client and server. Import with `import type`:
```ts
import type { TServedMilk, TServedMilkStatus } from 'baby-statistic-common';
import type { TDataOrError } from 'baby-statistic-common';
```
| File | Exports |
|---|---|
| `servedMilk.ts` | `TServedMilkStatus`, `TServedMilk`, `TPostServedMilk`, `TCreateServedMilk`, `TServedMilkTotal` |
| `drankMilk.ts` | `TDrankMilkSource`, `TDrankMilk`, `TPostDrankMilk` |
| `sleep.ts` | `TSleep`, `TPostSleep` |
| `pee.ts` | `TPee`, `TPostPee` |
| `poop.ts` | `TPoop`, `TPostPoop` |
| `TUtils.ts` | `TDataOrError<T>` |
| `index.ts` | re-exports all of the above |

`common/util/` holds shared runtime utilities (client-side only). Import from the `util` subpath:
```ts
import { fetch2 } from 'baby-statistic-common/util';
```
| File | Exports |
|---|---|
| `fetch.ts` | `fetch2<T>` — typed fetch wrapper returning `TDataOrError<T>` |
| `index.ts` | re-exports all of the above |

To add new shared types, create or extend a file in `common/types/` and re-export from `index.ts`. To add a new utility, create a file in `common/util/` and re-export from `common/util/index.ts`. No build step is needed — `common/package.json` points `"types"` and `"exports"` directly at the TypeScript source.

## Documentation (`doc/`)
The `doc/` folder contains living documentation for each layer of the project:

| File | Covers |
|---|---|
| `doc/server.md` | Express setup, file structure, scripts, Docker |
| `doc/client.md` | React app structure, components, Vite config |
| `doc/db.md` | SQLite schema, migrations, triggers |
| `doc/common.md` | Shared types package, exports, usage |
| `doc/rest-api.md` | All REST endpoints with request/response shapes |
| `doc/openAPI.json` | OpenAPI 3.0.3 spec — served as Swagger UI at `/api-docs` |

**Before any change consider the documentation**

**After every change, update the relevant doc file(s):**
- New route → add endpoint to `doc/rest-api.md`, update `doc/server.md`, **and update `doc/openAPI.json`**
- Schema change (new migration) → update `doc/db.md`
- New/changed shared type → update `doc/common.md`
- New component or client-side pattern → update `doc/client.md`
- New package, script, or server pattern → update `doc/server.md`

**`doc/openAPI.json` must always be kept in sync with the actual routes.** Every time a route is added, removed, or its request/response shape changes, update the spec. The Swagger UI at `http://localhost:3000/api-docs` reads this file directly.

---

## JavaScript/TypeScript Guidelines
* **Always prefer utilities from `common/util/` over ad-hoc implementations** — e.g., use `fetch2` instead of raw `fetch`, use shared types instead of duplicating them locally. Check `common/util/` before writing new helper logic.
* Always annotate public-facing functions, methods, and exported constants with explicit types (e.g., return types and parameter types).
* Use `T[]` for array types rather than `Array<T>`.
* Avoid using `any`; prefer `unknown`, or better yet, fully typed types.
* Use `async/await` syntax—no direct `.then()` chains unless necessary.
* When using class properties, prefer arrow methods for callbacks to preserve `this`.
* Always use arrow functions (`() =>`), never `function` declarations.
* Use modern array methods (`.map()`, `.filter()`, `.reduce()`), and avoid `for`, `for-in`, `for-of`, or `while` loops.
* Prefer `const` over `let`, and never use `var`.
* Always use strict equality (`===`, `!==`).
* Use destructuring for objects and arrays.
* Use template literals and other ES6+ features where possible.
* Do not use `interface`; always use `type` for object or function type definitions.
* Always handle possible `null` or `undefined`—use optional chaining (`?.`) or explicit checks.
* Use optional chaining and nullish coalescing (`??`) to safely handle missing values.
* Prefer modern features: e.g., `?.`, `??`, `?.()` for method calls, and **enum** or **tagged unions** for robust type discrimination.
* When creating a React component, if there are any props, create a type, TProps. Then set the type of the props as `{ someValue }: TProps`.
* In React components never use && to conditionally render elements. Instead, use a ternary operator or an early return.
* In React avoid using `useEffect` for simple state updates; prefer using state setters directly.
* In React avoid using inline styles; prefer CSS classes and put the stying in the component's CSS file or in its parents CSS if it does not have one.
* Avoid using "as" unless absolutely necessary; prefer type assertions or type guards.
* Don't specify return types for React components; Don't import React in files that only use JSX.
* Make your explanations short and don't talk too much in general.
* After writing code, do not try to run it, unless specifically asked to do so.

