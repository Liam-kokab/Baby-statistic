## Project Overview
Baby statistics tracker — logs milk, sleep, pee, poop, medicine, and pumping events for a baby. Supports multiple babies and multiple users (JWT auth, admin/user roles).

## Architecture
npm workspaces monorepo with five packages:
- **`common/`** — shared TypeScript types only (`baby-statistic-common`); no build step
- **`client/`** — React 19, Vite, TypeScript, CSS Modules, emoji icons
- **`server/`** — Express 5, TypeScript, `better-sqlite3` (SQLite), JWT auth, multi-baby/multi-user
- **`mcp-server/`** — Model Context Protocol server exposing the REST API as tools for AI agents (SSE transport, port 3001); talks to the main API over HTTP via `BABY_API_URL`
- **`ddns-keeper/`** — standalone service keeping a Domeneshop DNS A record in sync with the current public IP (port 3010); independently deployable, has its own `test` script (vitest)

Production: Express serves the Vite-built client from `server/public` (static files).

## Dev Workflow
```
npm run dev          # starts client + server + mcp-server concurrently (cyan = client, yellow = server, magenta = mcp)
npm run dev:client   # Vite dev server only (port 5173)
npm run dev:server   # nodemon + ts-node server only (port 3000)
npm run dev:mcp      # mcp-server only (port 3001)
npm run dev:ddns     # ddns-keeper only (port 3010)
npm run build        # tsc + vite build for client/server/mcp-server/ddns-keeper, writes dist/buildTime.json
npm run deploy       # bash deploy.sh
npm run pm2:start / pm2:restart / pm2:stop / pm2:status / pm2:logs   # manage all PM2-managed processes
```
Vite proxies all `/api/*` requests to `http://localhost:3000` in dev (`client/vite.config.ts`).
No root `lint`/`test` script exists yet; ESLint flat config lives in `eslint.config.mjs` (run via `npx eslint .`).

## Server Patterns

Server code is layered: **route → service → repository → db**. Routes handle HTTP concerns only, services hold business logic, repositories are the only layer that runs SQL against `db`.

### Adding a route
1. Create `server/src/repositories/<name>Repository.ts` — exports an object of functions that run SQL via `db.prepare(...)`, scoped by `baby_id` where the table has one, and maps DB rows (`snake_case`) to API types (`camelCase`) via a local `fromDb` helper.
2. Create `server/src/services/<name>Service.ts` — exports an object of functions that call the repository, taking a `TBabyContext` (`{ babyId, userId }`, from `server/src/types.ts`) for scoping/auditing instead of talking to `db` directly.
3. Create `server/src/routes/<name>.ts` — instantiate `Router()`, apply `requireUser` (or `requireAdmin`) from `../middleware/requireAdmin`, build `ctx(req)` from `req.user`, call the service, export default.
4. Mount in `server/src/index.ts` under `app.use('/api/<name>', ...)`.

```ts
// server/src/repositories/pumpingRepository.ts
export const pumpingRepository = {
  findAll: (filter: TTimeFilter, babyId: number): TPumping[] => {
    const rows = db.prepare<unknown[], TPumpingDb>('SELECT * FROM pumping WHERE baby_id = ?').all(babyId);
    return rows.map(fromDb);
  },
  // ...insert/update/delete follow the same (data, babyId) shape
};

// server/src/routes/pumping.ts
import { pumpingService } from '../services/pumpingService';
import { requireUser } from '../middleware/requireAdmin';
import type { TBabyContext } from '../types';

const router = Router();
router.use(requireUser);
const ctx = (req: Request): TBabyContext => ({ babyId: req.user!.babyId!, userId: req.user!.id });

router.get('/', (req: Request, res: Response): void => {
  res.json(pumpingService.findAll(req.query, ctx(req)));
});
export default router;
```

Existing routes: `servedMilk`, `drankMilk`, `sleep`, `pee`, `poop`, `medicine`, `pumping`, `milestone`, `predictions`, `auth`, `admin`, `baby`, `backup`, `buildTime`, `nappy`, `ping`.

### Auth & multi-baby scoping
- `server/src/middleware/authenticate.ts` — verifies the JWT access token (`Authorization: Bearer ...`) and populates `req.user` (`{ id, username, role, babyId, authTime }`).
- `server/src/middleware/requireAdmin.ts` — exports both `requireAdmin` (role must be `admin`) and `requireUser` (role must be `user` and have a `babyId`); apply one per route file via `router.use(...)`.
- `server/src/middleware/requireRecentAuth.ts` — gates sensitive actions (e.g. changing settings) behind a recent explicit login, using the token's `authTime`.
- Every event table (`served_milk`, `drank_milk`, `sleep`, `pee`, `poop`, `medicine`, `medicine_log`, `pumping`, `prediction_log`) has `baby_id` + `created_by` columns; repositories must filter/insert with `baby_id` to keep data isolated per baby.
- See `doc/auth.md` for the full JWT/refresh-token/role design.

### Database singleton
`server/src/db.ts` exports a single `db: Database.Database` instance. Migrations run automatically on `import './db'` (already done in `index.ts`). Never create a second `Database` instance.

### Adding a migration
Append an entry to the `migrations` array in `server/src/migrations/index.ts`. Names must be unique and sortable (e.g., `'002_add_weight'`). Migrations apply once and are tracked in the `_migrations` table.

### DB schema (migration `001_schema`, extended by later migrations)
| Table | Key columns |
|---|---|
| `served_milk` | `amount`, `original_amount`, `status` (`FRIDGE`\|`FREEZER`\|`USED`\|`EXPIRED`), `expiry_date` |
| `drank_milk` | `amount`, `source` (`FRIDGE`\|`FREEZER`\|`BOOB`) |
| `sleep` | `start` (TEXT), `end` (TEXT, nullable) |
| `pee` | timestamps only |
| `poop` | timestamps only |
| `medicine` | `name`, `is_active` (added `010_simplify_medicine`, `013_medicine_is_active_ensure`) |
| `medicine_log` | `medicine_id`, `taken_at` (added `006_medicine`) |
| `pumping` | timestamp only (added `009_pumping`) |
| `prediction_log` | ML training data for milk-amount predictions (added `011_prediction_logs`, evolved `012_prediction_logs_v2`) |
| `babies`, `users`, `baby_users`, `refresh_tokens` | multi-baby/multi-user auth tables (added `014_auth`) |
| `milestone` | `title`, `description` (nullable), `occurred_at` (added `017_milestones`) |

Migration `015_add_baby_and_user_cols` added `baby_id` + `created_by` columns to every event table above (except the auth tables themselves) for per-baby data isolation; `016_add_user_display_name` added `name` to `users`. See `doc/db.md` for the full migration list.

All tables have `created_at` (TEXT, ISO datetime); `_migrations` tracks applied migrations.

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

All design tokens (colors, radii, shadows, spacing) are CSS custom properties defined in `client/src/styles/variables.css` on `:root`. They are loaded globally via `global.css` → `main.tsx`, so every module CSS file can use them directly with `var()` — **no import needed**:
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

### Auth
- `client/src/utils/authStore.ts` holds auth state (access/refresh tokens, current user) in localStorage; `client/src/utils/authFetch.ts` wraps `fetch2` calls with the `Authorization` header and handles token refresh.
- `client/src/components/ProtectedRoute/ProtectedRoute.tsx` gates routes behind login (and optionally role) — wrap pages that require auth with it in the router, rather than checking auth state ad hoc in each page.
- Admin-only pages (`AdminBabiesPage`, `AdminUsersPage`) and `SettingsPage`, `LoginPage` follow this pattern; see `doc/auth.md`.

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
| `medicine.ts` | `TMedicineDb`, `TMedicine`, `TPostMedicine`, `TMedicineLogDb`, `TMedicineLog`, `TPostMedicineLog`, `TMedicineWithLatestLog` |
| `pumping.ts` | `TPumpingDb`, `TPumping`, `TPostPumping` |
| `summaries.ts` | `TDrankMilkSummary`, `TSleepSummary`, `TNappySummary`, `TPumpingSummary` |
| `milestone.ts` | `TMilestoneDb`, `TMilestone`, `TPostMilestone`, `TUpdateMilestone` |
| `auth.ts` | `TUserRole`, `TUserConfig`, `TUserDb`, `TUser`, `TBabyDb`, `TBaby`, `TRefreshTokenDb`, `TLoginRequest`, `TLoginResponse`, `TRefreshResponse`, `TJwtPayload`, `TAdminCreateUser`, `TUpdateMeRequest`, `TAdminUpdateUser`, `TAdminCreateBaby` |
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
| `doc/server.md` | Express setup, file structure, scripts |

| `doc/client.md` | React app structure, components, Vite config |
| `doc/db.md` | SQLite schema, migrations, triggers |
| `doc/common.md` | Shared types package, exports, usage |
| `doc/rest-api.md` | All REST endpoints with request/response shapes |
| `doc/openAPI.json` | OpenAPI 3.0.3 spec — served as Swagger UI at `/api-docs` |
| `doc/pm2.md` | PM2 process management: ecosystem config (server, mcp-server, ddns-keeper, health-check watchdogs), start/restart scripts |
| `doc/auth.md` | JWT auth design: short-lived access tokens, rotating refresh tokens, admin/user roles, per-baby data isolation |
| `doc/mcp-server.md` | MCP server: SSE transport, tool definitions, env vars |
| `doc/ddns-keeper.md` | DDNS keeper service: polling, retry/backoff, health server |
| `doc/prediction-analysis.md` | Changelog of the milk-amount prediction algorithm with backtest metrics |
| `doc/userGuid.md` | End-user guide for the app's UI/navigation |
| `doc/nginx.md` | Production nginx/TLS reverse-proxy setup |

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

