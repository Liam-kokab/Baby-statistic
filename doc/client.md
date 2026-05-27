# Client

## Stack
- **Framework**: React 19 (with `StrictMode`)
- **Bundler**: Vite 8 (`@vitejs/plugin-react`)
- **Language**: TypeScript
- **Routing**: `react-router-dom` v6 (`BrowserRouter`, `Routes`, `Route`, `useNavigate`, `useLocation`, `useSearchParams`)
- **Styling**: CSS Modules (`.module.css` per component) + shared `variables.css` (CSS custom properties)
- **Icons**: Plain emoji characters — passed via the `emoji` prop on `Button` or rendered directly as text
- **Font**: [Nunito](https://fonts.google.com/specimen/Nunito) (loaded via Google Fonts in `index.html`)
- **Theme**: Three selectable baby palettes (persisted in localStorage) with light and dark variants:
  - `girl`: soft pinks & lavenders
  - `neutral` (default): soft green/beige neutral palette
  - `boy`: soft blue palette
  The selected theme is stored under the `theme` key in localStorage and applied by adding `theme-<name>` (or `theme-<name>-dark`) on the `<html>` element. The Settings page exposes a three-way toggle (👧/🌿/👦) to switch themes, and a separate Mode toggle (🌞 Light / ⚙️ Auto / 🌙 Dark) to choose light/dark/auto behavior (stored under `themeMode`, default `auto`).
- **Dev port**: `5173` (Vite dev server; proxies `/api/*` → `http://localhost:3000`)

## File Structure
```
client/
  src/
    main.tsx                        # entry — imports global.css, mounts <App /> inside <BrowserRouter>
    App.tsx                         # root — <Routes> + <NavBar> + <InstallBanner>
    App.module.css                  # app shell layout
    types.ts                        # legacy client types (TPage — kept for reference)
    vite-env.d.ts
    styles/
      variables.css                 # CSS custom properties on :root
      global.css                    # CSS reset + base html/body styles
    components/
      Button/                       # Button.tsx + Button.module.css
      DateRangeFilter/              # DateRangeFilter.tsx + DateRangeFilter.module.css
      DateTimeInput/                # DateTimeInput.tsx + DateTimeInput.module.css
      Input/                        # Input.tsx + Input.module.css
      InstallBanner/                # PWA install prompt banner
      NavBar/                       # NavBar.tsx + NavBar.module.css
      PageLayout/                   # PageLayout.tsx + PageLayout.module.css
    pages/
      HomePage/
      PoopPeePage/
      MilkSavedPage/
      MilkDrankPage/
      SleepPage/
      PumpingPage/
      EditStoredMilkPage/
      EditDrankMilkPage/
      EditSleepPage/
      EditPoopPeePage/
      EditPumpingPage/
    utils/
      groupByDay.ts                 # groups items by calendar day (descending)
      groupByWeek.ts                # groups items by Mon–Sun week (descending); uses format.ts for week label
      format.ts                     # date/time formatting helpers (Oslo tz, 24h, DD-MM-YYYY)
      useInstallPrompt.ts           # hook: captures beforeinstallprompt, exposes install() / dismiss()
  index.html                        # HTML shell — Nunito font, manifest link, SW registration, viewport-fit=cover
  vite.config.ts
  package.json
  tsconfig.json
  tsconfig.node.json
```

## Routing
`react-router-dom` v6 is used. `App.tsx` renders a `<Routes>` block with a route per page. Navigation is handled by `NavBar` via `useNavigate`. Filter state (date range, view mode) is stored in URL search params via `useSearchParams`.

| Path | Component |
|---|---|
| `/` | `HomePage` |
| `/milk-saved` | `MilkSavedPage` |
| `/milk-drank` | `MilkDrankPage` |
| `/sleep` | `SleepPage` |
| `/pumping` | `PumpingPage` |
| `/poop-pee` | `PoopPeePage` |
| `/stored-milk/:id` | `EditStoredMilkPage` |
| `/drank-milk/:id` | `EditDrankMilkPage` |
| `/sleep/:id` | `EditSleepPage` |
| `/pee/:id` | `EditPoopPeePage` (type="pee") |
| `/poop/:id` | `EditPoopPeePage` (type="poop") |
| `/pumping/:id` | `EditPumpingPage` |
| `*` | Redirects to `/` |

## Theme tokens (`styles/variables.css`)
All tokens are CSS custom properties on `:root` — available in every module without any import.

| Token | Value | Use |
|---|---|---|
| `--color-primary` | `#ec407a` | Buttons, active states |
| `--color-primary-dark` | `#c2185b` | Hover, week headers, strong accents |
| `--color-primary-light` | `#fce4ec` | Subtle backgrounds, day headers, chips |
| `--color-secondary` | `#ab47bc` | Secondary accents |
| `--color-bg` | `#fef0f7` | Page background |
| `--color-surface` | `#ffffff` | Cards, inputs |
| `--color-text` | `#3d1a2e` | Body text |
| `--color-text-muted` | `#9d7a90` | Placeholders, subtitles |
| `--color-border` | `#f8bbd0` | Borders |
| `--navbar-height` | `3.125rem` (50px) | Reserved for fixed NavBar |

Use in any module CSS file with `var()` — no import needed: e.g. `color: var(--color-primary);` and `border-radius: var(--radius-md);`

## Units / Sizing policy

- Root font-size is set to `16px` so `1rem = 16px` across the client. Use rem-based variables for spacing, font sizes and radii defined in `styles/variables.css` (e.g. `--space-md`, `--radius-md`).
- Keep `%` units where currently used for fluid layouts.
- Allowed px exceptions: shadows, media-query breakpoints, borders/hairlines (1px/2px), and SVG stroke widths — these may remain in px for crisp rendering.

## Components

### `Button`
Props: `text?`, `emoji?`, `onClick?`, `disabled?`, `loading?`, `variant?` (`'primary' | 'secondary' | 'ghost'`), `type?`, `className?`

- Shows a CSS spinner while `loading=true`
- `emoji` renders in a `<span>` before the text
- Pill-shaped (`border-radius: 9999px`); full gradient for primary variant

### `Input`
Props: `label?`, `value`, `onChange`, `type?` (`'text' | 'tel'`), `placeholder?`, `disabled?`, `error?`, `name?`

- Renders a `<label>` when `label` is provided
- Shows error message + red border via `.hasError` modifier

### `DateTimeInput`
Same props as `Input` (minus `type` — always `datetime-local`).
Sets `color-scheme: light` to prevent dark-mode calendar icon tinting on iOS.

### `DateRangeFilter`
Props: `from`, `to`, `view`, `onFromChange`, `onToChange`, `onViewChange`

Exported type: `TView = 'item' | 'day' | 'week'`

Renders two date inputs and a three-way toggle:
- **📋 Item by item** — flat list, newest first
- **📅 Day by day** — grouped by calendar day, collapsible (collapsed by default)
- **📆 Week by week** — grouped by Mon–Sun week, collapsible weeks + collapsible days within (both collapsed by default)

### `NavBar`
No props. Uses `useNavigate` and `useLocation` hooks internally.

Fixed bottom bar with six emoji buttons. Active page is highlighted with a raised pink pill.

| Position | Path | Emoji | Label |
|---|---|---|---|
| 1 | `/poop-pee` | 💩 | Poop & Pee |
| 2 | `/medicine` | 💊 | Medicine |
| **Centre** | `/` | 🏠 | Home |
| 4 | `/milk-drank` | 🍼 | Milk Drank |
| 5 | `/sleep` | 🌙 | Sleep |
| 6 | `/pumping` | 🥛 | Pumping |

### `PageLayout`
Props: `title`, `emoji`, `children`, `gradient?` (`'pink' | 'blue' | 'green' | 'indigo' | 'amber'`)

Wraps every secondary page with a gradient header banner (curved bottom edge) and a scrollable content area.

## Pages

| Page | Path | Gradient | Emoji |
|---|---|---|---|
| `HomePage` | `/` | pink→lavender | 🌸 |
| `PoopPeePage` | `/poop-pee` | amber | 💩 |
| `MilkSavedPage` | `/milk-saved` | blue | 🧊 |
| `MilkDrankPage` | `/milk-drank` | green | 🍼 |
| `SleepPage` | `/sleep` | indigo | 😴 |

### `HomePage`
- **Sleep section**: fetches `GET /api/sleep/latest` on mount; shows Sleeping/Awake badge with a live elapsed-time counter (JS `setInterval`, no polling). Timer counts up from `start` when sleeping, and from `end` of last sleep when awake. Clicking Start/End calls POST/PUT and re-fetches latest.
- **Milk — Store**: `POST /api/served-milk` with `{ amount, status: 'FRIDGE' | 'FREEZER' }`.
- **Milk — Baby drank**: `POST /api/drank-milk` with `{ amount, source }` — three buttons: **Fridge**, **Freezer**, and **Boob** (`source: 'FRIDGE' | 'FREEZER' | 'BOOB'`). For `FRIDGE`/`FREEZER` the server deducts from stored milk; `BOOB` does not touch storage.
- **Milk — Waste**: `POST /api/drank-milk/waste` with `{ amount }` — server subtracts from the latest drank record; does not touch storage.
- **Nappy**: `POST /api/poop` and `POST /api/pee`.

### `MilkSavedPage` / `MilkDrankPage`
Both support three views via `DateRangeFilter` (stored in URL search params):
- **Item view**: flat sorted list
- **Day view**: items grouped by day; each day header is clickable and collapsed by default
- **Week view**: items grouped by Mon–Sun week; week header shows **total ml** and **~avg ml/day** (total ÷ 7); both week rows and day rows within are collapsed by default

Collapse state is local to the component (`useState<Set<string>>`).

`MilkDrankPage` shows a stats bar **below** the filter (affected by date range): total ml consumed + avg ml per day (`total ÷ days in range`). If any entry in the period has `source === 'BOOB'`, all totals and averages are marked with `*` (e.g. `340* ml`) to indicate the figure is likely inaccurate. The same `*` marker appears on day and week group headers when that group contains a BOOB entry. Item cards and expanded day rows show a source emoji (🧊 FRIDGE, ❄️ FREEZER, 🤱 BOOB).  
`MilkSavedPage` shows a stats bar **above** the filter with live fridge/freezer/total stock (not date-filtered).
## Utilities (`src/utils/`)

### `groupByDay<T>(items)`
Groups items by their `createdAt` date (`YYYY-MM-DD`), sorted newest-first.
Returns `{ date: string; items: T[] }[]`.

### `groupByWeek<T>(items)`
Groups items by ISO Mon–Sun week, sorted newest-first. Uses UTC date arithmetic to determine Monday of each week.
Returns `{ weekKey: string; weekLabel: string; days: { date: string; items: T[] }[] }[]`.
`weekLabel` is formatted as e.g. `"14-04 – 20-04-2026"` using `formatDate` from `format.ts`.

## Date / Time Formatting (`src/utils/format.ts`)
All display formatting uses `Intl.DateTimeFormat` with `timeZone: 'Europe/Oslo'` and `hourCycle: 'h23'`. No locale-dependent `toLocaleString` calls in components.

| Function | Output example |
|---|---|
| `formatTime(str)` | `14:30` |
| `formatDate(str)` | `14-04-2026` |
| `formatDateTime(str)` | `14-04-2026 14:30` |
| `formatDateWithWeekday(str, includeYear?)` | `Tue 14-04-2026` / `Tue 14-04` |

## PWA (`public/manifest.json` + `public/sw.js`)
The app is installable as a PWA on Android (requires HTTPS). Key files:

| File | Purpose |
|---|---|
| `public/manifest.json` | App name, icons, `display: standalone`, theme colour, screenshot |
| `public/sw.js` | Minimal passthrough service worker (required for install prompt) |
| `public/icon-maskable.svg` | Maskable home-screen icon |
| `public/screenshot-home.svg` | Screenshot shown in Chrome install dialog |
| `src/utils/useInstallPrompt.ts` | Hook that captures `beforeinstallprompt` |
| `src/components/InstallBanner/` | Banner shown when install is available; has Install + dismiss buttons |

## Dev Proxy
`vite.config.ts` proxies `/api/*` → `http://localhost:3000`.

## Build
```
npm run build -w client   # tsc type-check + vite build → dist/public/
```
Output goes to `dist/public/` (project root), which is served by Express in production.
