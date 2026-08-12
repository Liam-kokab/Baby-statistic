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
      Checkmark/                    # Checkmark.tsx + Checkmark.module.css
      DateRangeFilter/              # DateRangeFilter.tsx + DateRangeFilter.module.css
      DateTimeInput/                # DateTimeInput.tsx + DateTimeInput.module.css
      Input/                        # Input.tsx + Input.module.css
      Textarea/                     # Textarea.tsx + Textarea.module.css
      Toggle/                       # Toggle.tsx + Toggle.module.css — animated segmented control (2-4 options)
      InstallBanner/                # PWA install prompt banner
      NavBar/                       # NavBar.tsx + NavBar.module.css (includes logout 🚪)
      NavOrderEditor/                # NavOrderEditor.tsx + .module.css — up/down reordering of NavBar feature buttons (Settings → Navigation tab)
      HomeWidgetsEditor/             # HomeWidgetsEditor.tsx + .module.css — show/hide + up/down reordering of HomePage widgets (Settings → Home tab)
      WhiteNoiseSoundsEditor/        # WhiteNoiseSoundsEditor.tsx + .module.css — choose which sounds appear in the HomePage White Noise widget (Settings → Home tab)
      Tabs/                          # Tabs.tsx + Tabs.module.css — generic tab-bar control used by SettingsPage
      PageLayout/                   # PageLayout.tsx + PageLayout.module.css
      BlackScreenOverlay/            # BlackScreenOverlay.tsx + .module.css — shared "always on display" overlay (time/sleep/pump/bottle readout), rendered by both HomePage and PageLayout via useBlackScreen
      DataFreshnessDot/              # DataFreshnessDot.tsx + .module.css — small colored dot (top-right of the banner) showing how old a page's data is; hover shows the exact age via native `title` tooltip
      BackupStatusDot/               # BackupStatusDot.tsx + .module.css — small colored dot rendered beside DataFreshnessDot, showing how long ago the last successful backup was (app-wide, not per-page)
      ProtectedRoute/               # ProtectedRoute.tsx — redirects to /login if unauthenticated
    pages/
      LoginPage/                    # LoginPage.tsx + LoginPage.module.css — username/password form
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
      MilestonePage/
      EditMilestonePage/
      WhiteNoisePage/                # WhiteNoisePage.tsx + .module.css — client-generated white/pink/brown noise player
    utils/
      authStore.ts   # localStorage helpers: getAccessToken/getRefreshToken/setTokens/clear/isAuthenticated
      authFetch.ts   # typed fetch wrapper: attaches Bearer token, auto-refreshes on 401, redirects to /login on failure
      navItems.ts    # shared NavBar item constants (HOME_ITEM, SETTINGS_ITEM, USER_FEATURE_ITEMS, ADMIN_MAIN_ITEMS, VISIBLE_FEATURE_COUNT)
      navOrder.ts    # localStorage-backed custom nav order + hidden set (keys `navOrder`, `navHidden`): getSavedNavOrder/saveNavOrder/clearNavOrder/applyNavOrder + getHiddenNavItems/saveHiddenNavItems/clearHiddenNavItems
      homeWidgets.ts     # shared HomePage widget constants (DEFAULT_HOME_WIDGETS: sleep/milk/nappy/medicines/whiteNoise; DEFAULT_HIDDEN_HOME_WIDGETS: whiteNoise)
      homeWidgetPrefs.ts # localStorage-backed HomePage widget order/visibility (keys `homeWidgetOrder`, `homeWidgetHidden`): get/save/clear + applyHomeWidgetOrder
      homeWhiteNoiseWidgetPrefs.ts # sound metadata (`WHITE_NOISE_SOUNDS`) + localStorage-backed sound selection for the HomePage white-noise widget (key `homeWidgetWhiteNoiseTypes`): getSelectedWhiteNoiseTypes/saveSelectedWhiteNoiseTypes (defaults to all 3 sounds; configured on Settings → Home)
      blackScreenPrefs.ts # localStorage-backed HomePage black-screen readout prefs: `BLACK_SCREEN_FIELDS` (`'time' | 'sleep' | 'pump' | 'bottle'`), getHiddenBlackScreenFields/saveHiddenBlackScreenFields (key `blackScreenHiddenFields`, default: none hidden), getBlackScreenOpacityPercent/saveBlackScreenOpacityPercent (key `blackScreenOpacity`, whole percent 0–100, default `15`) — the readout text is always white, this opacity is what keeps it dim
      useBlackScreen.ts  # shared hook: open/close state, fullscreen enter/exit, optional wake-lock "keep awake" (pass `keepAwakeMs`), auto-hiding exit button/cursor — used by both HomePage and PageLayout so every page's black screen behaves identically
      useAlwaysOnDisplayData.ts # hook: fetches GET /api/home/always-on-display while `active` (the black screen is open), immediately on activation and every 5 minutes after — powers BlackScreenOverlay's readout on every page
      useDataFreshness.ts # hook: `{ lastUpdatedAt, isError, reportSuccess, reportError }` — instantiated once per data page; the page calls `reportSuccess()`/`reportError()` from its own load function(s), then passes the result to `PageLayout`'s `dataFreshness` prop (or renders `DataFreshnessDot` directly, as `HomePage` does) to drive the freshness dot
      useBackupStatus.ts # hook: `{ lastBackupAt, isError }` — fetches GET /api/app-events/backup via authFetch once on mount and every 5 minutes after; powers BackupStatusDot (app-wide, not per-page)

> See [`doc/auth.md`](./auth.md) for full client auth architecture documentation.
      groupByDay.ts                 # groups items by calendar day (descending)
      groupByWeek.ts                # groups items by Mon–Sun week (descending); uses format.ts for week label
      format.ts                     # date/time formatting helpers (Oslo tz, 24h, DD-MM-YYYY)
      useInstallPrompt.ts           # hook: captures beforeinstallprompt, exposes install() / dismiss()
      whiteNoise.ts                 # WhiteNoisePlayer singleton — synthesizes & loops white/pink/brown noise via Web Audio API (no audio files)
      whiteNoiseDurations.ts        # shared WHITE_NOISE_DURATION_OPTIONS (infinite/30/60 min) + formatWhiteNoiseRemaining — used by WhiteNoisePage and the HomePage widget
      useWhiteNoisePlayerState.ts   # hook: subscribes to whiteNoisePlayer, returns { playingType, endAt, activeDuration }, ticks every second while timed
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
| `/milestones` | `MilestonePage` |
| `/milestones/:id` | `EditMilestonePage` |
| `/stored-milk/:id` | `EditStoredMilkPage` |
| `/drank-milk/:id` | `EditDrankMilkPage` |
| `/sleep/:id` | `EditSleepPage` |
| `/pee/:id` | `EditPoopPeePage` (type="pee") |
| `/poop/:id` | `EditPoopPeePage` (type="poop") |
| `/pumping/:id` | `EditPumpingPage` |
| `/white-noise` | `WhiteNoisePage` |
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

### `Checkmark`
Props: `checked`, `onChange`, `label?`, `disabled?`

- Styled checkbox button using CSS (no emoji, no library)
- Shows a filled box with a white tick when `checked`, empty border box when unchecked
- Uses `--color-primary` / `--color-border` design tokens
- `label` renders an inline text label next to the box

### `Toggle`
Props: `options: string[]` (2–4 items), `value?` (controlled selected index), `defaultIndex?` (uncontrolled), `onChange?(index)`, `name?`, `className?`

- Animated segmented control (pill-shaped sliding thumb) used for Theme/Mode/Language pickers on `SettingsPage`
- Each option label may be `"<emoji> <text>"`; `Toggle` auto-detects the emoji and, based on measured available width, progressively degrades from full (icon+text) → text-only → icon-only per option so it never overflows on narrow screens
- Fully keyboard-accessible (`role="tablist"`/`"tab"`, arrow keys/Home/End/Enter/Space)

### `Input`
Props: `label?`, `value`, `onChange`, `type?` (`'text' | 'tel'`), `placeholder?`, `disabled?`, `error?`, `name?`

- Renders a `<label>` when `label` is provided
- Shows error message + red border via `.hasError` modifier

### `Textarea`
Props: `label?`, `value`, `onChange`, `placeholder?`, `disabled?`, `error?`, `name?`, `rows?` (default `4`)

- Multi-line variant of `Input`; used for free-text notes (e.g. milestone descriptions)
- Same error/label conventions as `Input`; `resize: vertical`

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

Fixed bottom bar with a **Home** button, a collapsible **☰ menu**, and reorderable + optional "feature" buttons for user accounts. Four positions never move and can't be hidden: **Home** (always the 2nd main-bar button, right after the first visible feature item), the **☰ menu** button itself (always the very first button, before Home), **Settings** (always the last item inside the arc menu), and **🚪 Logout** (always the very last arc item). Everything else — Pumping, Milk Drank, Sleep, Poop & Pee, Medicine, Milk Saved, Milestones, White Noise — is a user-reorderable/hideable "feature item" (`utils/navItems.ts` → `USER_FEATURE_ITEMS`). The user's custom order is read from `utils/navOrder.ts` (localStorage key `navOrder`) via `applyNavOrder()`, and hidden feature items (localStorage key `navHidden`, via `getHiddenNavItems()`) are filtered out entirely before the remaining ones are split: of the first `VISIBLE_FEATURE_COUNT` (3) items of that ordered/filtered list, the 1st renders before Home and the remaining 2 render after Home on the main bar; the rest render inside the ☰ arc menu (before Settings/Logout). Users configure order + visibility on the **Settings → Navigation** tab (`NavOrderEditor` component).

Note: the NavBar includes the device safe-area inset (e.g. `env(safe-area-inset-bottom)`) in its
total height on mobile so non-active buttons stay vertically centered above the top border. Only
the active button is visually raised and overlaps the border. This prevents buttons from appearing
too high on phones with a home indicator.

Default order (before any user customization), left to right:

| Position | Path | Emoji | Label |
|---|---|---|---|
| 1 (fixed, ☰ menu) | — | ☰ | Menu |
| 2 | `/pumping` | 🥛 | Pumping |
| 3 (fixed) | `/` | 🏠 | Home |
| 4 | `/milk-drank` | 🍼 | Milk Drank |
| 5 | `/sleep` | 🌙 | Sleep |

Menu (☰), default order: `/poop-pee` 💩, `/medicine` 💊, `/milk-saved` 🧊, `/milestones` 🏆, `/white-noise` 🎧, then `/settings` ⚙️ (fixed), plus 🚪 logout (fixed).

Admin accounts keep a separate, non-reorderable nav (`ADMIN_MAIN_ITEMS`): `/admin/babies` 👶, `/admin` 🔑, `/admin/users` 👥, with `/settings` ⚙️ + 🚪 logout in the menu.

### `Tabs`
Props: `tabs: { key: string; label: string; emoji? }[]`, `activeKey`, `onChange(key)`

Generic pill-style tab bar (no routing) — used by `SettingsPage` to switch between Account/Appearance/Navigation/Home/About sections without leaving the page.

### `NavOrderEditor`
No props. Reads/writes the user's `NavBar` feature-item order and hidden set via `utils/navOrder.ts`. Renders each feature item with a `Checkmark` (visible/hidden toggle), its emoji, label, an "On bar" / "In menu" badge (computed only over the not-hidden items, based on position vs. `VISIBLE_FEATURE_COUNT` — hidden away from the badge entirely), and ⬆️/⬇️ buttons to move it; a "Reset to default" button clears both the order (`clearNavOrder()`) and hidden set (`clearHiddenNavItems()`). Used inside `SettingsPage`'s **Navigation** tab.

### `HomeWidgetsEditor`
No props. Reads/writes the user's `HomePage` widget order and hidden set via `utils/homeWidgetPrefs.ts`. Renders each widget (Sleep/Milk/Nappy/Medicines/White Noise) with a `Checkmark` (visible/hidden toggle), its label, and ⬆️/⬇️ buttons to move it; a "Reset to default" button clears both the custom order and hidden set, restoring the defaults (all widgets visible in their default order, **except** White Noise which defaults to hidden — see `DEFAULT_HIDDEN_HOME_WIDGETS`). Used inside `SettingsPage`'s **Home** tab.

### `WhiteNoiseSoundsEditor`
No props. Reads/writes which white-noise sounds (White/Fan/Wave) show up in the HomePage White Noise widget via `utils/homeWhiteNoiseWidgetPrefs.ts` (`getSelectedWhiteNoiseTypes`/`saveSelectedWhiteNoiseTypes`, localStorage key `homeWidgetWhiteNoiseTypes`). Renders one `Checkmark` per sound; defaults to all 3 selected. Used inside `SettingsPage`'s **Home** tab, alongside `HomeWidgetsEditor`.

### `PageLayout`
Props: `title`, `emoji`, `children`, `gradient?` (`'pink' | 'blue' | 'green' | 'indigo' | 'amber'`)

Wraps every secondary page with a gradient header banner (curved bottom edge) and a scrollable content area. Dynamic per-page CSS custom properties (`--hero-var`, `--banner-<gradient>-start/mid/end`) are typed via a local `TCSSVarProperties = CSSProperties & Record<\`--${string}\`, string>` alias — no `as any` casts needed.

- The banner emoji is clickable on every page using `PageLayout`. Clicking it opens the same fullscreen black-screen interaction as the Home page icon, with a centered `secondary`-variant Exit button that appears on click/mouse movement and hides after inactivity. (`PageLayout`'s overlay has no data readout — the dim data block is HomePage-only, since only `HomePage` tracks sleep/pumping/milk state.)

## Pages

### Admin pages

#### `AdminBabiesPage` (`/admin/babies`)
- Lists all babies from `GET /api/admin/babies`
- Inline form to create a new baby (`POST /api/admin/babies`)
- Delete button per row (`DELETE /api/admin/babies/:id`) with a confirmation prompt
- Shows baby id alongside name

#### `AdminUsersPage` (`/admin`, `/admin/users`)
- Lists all users from `GET /api/admin/users` — shows role emoji (🔑 admin / 👤 user), username, and assigned baby name
- Inline form to create a new user (`POST /api/admin/users`):
  - Fields: username, password, role selector (`user` / `admin`)
  - When `role = "user"` a baby dropdown appears (populated from `GET /api/admin/babies`), required
- Per-row **✏️ edit** action: inline form to update display name + username (`PATCH /api/admin/users/:id`)
- Per-row **🔒 set new password** action: inline form to set a user's password directly, no current-password check (`PATCH /api/admin/users/:id`)
- Delete button per row with a confirmation prompt

### User pages

| Page | Path | Gradient | Emoji |
|---|---|---|---|
| `HomePage` | `/` | pink→lavender | 🌸 |
| `PoopPeePage` | `/poop-pee` | amber | 💩 |
| `MilkSavedPage` | `/milk-saved` | blue | 🧊 |
| `MilkDrankPage` | `/milk-drank` | green | 🍼 |
| `SleepPage` | `/sleep` | indigo | 😴 |
| `MilestonePage` | `/milestones` | amber (gold) | 🏆 |

Note: `MilestonePage`'s `PageLayout` heading text is **"My first"** (not "Milestones") — component/route/API names stay `Milestone*`/`/api/milestones` for clarity in code, but the displayed page title is short and personal. `EditMilestonePage` displays **"Edit My First"**. Milestone pages pass explicit `bannerSlug` values (`my-first`, `edit-my-first`) to `PageLayout` so banner color overrides in `styles/variables.css` stay stable across translated titles.

### `DataFreshnessDot` (shared, `components/DataFreshnessDot/`)
Small dot in the top-right corner of every data page's banner, showing how old that page's data is:
- 🟢 green — last successful refresh was < 5 minutes ago
- 🟡 yellow — < 20 minutes ago
- 🔴 red — ≥ 20 minutes ago, **or** the most recent fetch attempt failed
- Hovering shows the exact age (native `title`/`aria-label` tooltip, e.g. "Data freshness — last updated 3 min ago"); ticks every 15s internally so the color/tooltip keep advancing even without a new fetch.

Each data page instantiates one `useDataFreshness()` (`utils/useDataFreshness.ts`) and calls `reportSuccess()`/`reportError()` from its own load function(s) alongside the existing `setState` calls, then passes the result as `dataFreshness` to `PageLayout` (which renders the dot itself when the prop is present). `HomePage` — which has its own custom hero instead of `PageLayout` — renders `DataFreshnessDot` directly. Wired up on `HomePage`, `PoopPeePage`, `SleepPage`, `PumpingPage`, `MedicinePage`, `MilkSavedPage`, `MilkDrankPage`, and `MilestonePage`; omitted on pages without genuinely "live" server data (Settings, Login, Admin, White Noise, Edit* single-record forms), where `PageLayout`'s `dataFreshness` prop is simply left unset and no dot renders.

### `BackupStatusDot` (shared, `components/BackupStatusDot/`)
Small dot rendered immediately beside `DataFreshnessDot` (same banner, offset further right), showing how long ago the last successful backup was reported:
- 🟢 green — last successful backup < 6 hours ago
- 🟡 yellow — < 12 hours ago
- 🔴 red — ≥ 12 hours ago, **or** no successful backup has ever been reported, **or** the status fetch failed
- Hovering shows the exact age (native `title`/`aria-label` tooltip); ticks every 60s internally so the color/tooltip keep advancing without a new poll.

Unlike `DataFreshnessDot` (per-page data), this is app-wide, global data — it fetches `GET /api/app-events/backup` via `utils/useBackupStatus.ts` (`authFetch`) once on mount and every 5 minutes thereafter, independent of any page's own data loading. Rendered unconditionally wherever `DataFreshnessDot` renders (`PageLayout` and `HomePage`'s custom hero) — no `dataFreshness`-style prop needed since it doesn't depend on the page.

### `HomePage`
Widgets — **Sleep**, **Milk**, **Nappy**, **Medicines**, **White Noise** — are rendered dynamically from `utils/homeWidgets.ts` (`DEFAULT_HOME_WIDGETS`, in that order). All are visible by default except `whiteNoise`, which is hidden by default (`DEFAULT_HIDDEN_HOME_WIDGETS`) — opt-in only. The user's custom order/visibility is read from `utils/homeWidgetPrefs.ts` (localStorage keys `homeWidgetOrder` and `homeWidgetHidden`) via `applyHomeWidgetOrder()`/`getHiddenHomeWidgets()`; hidden widgets are filtered out before rendering. Configured on the **Settings → Home** tab (`HomeWidgetsEditor` component). The `medicines` widget still only renders when `medicines.length > 0`, on top of the visibility toggle.

- **Data loading**: `GET /api/home/summary` (`THomeSummary`) combines sleep/drank-milk/suggested-amount/pumping/nappy/medicines into one call. It's used for the initial mount **and** every subsequent update — after any action (sleep toggle, drank milk, waste, poop/pee, pump, medicine taken) the page re-fetches this same endpoint rather than the narrower per-resource endpoints. `utils/useRefetchOnVisible` drives the tab-visible/stale-timer refresh of this call, and pauses entirely while the black screen is open (see below) via its `enabled` parameter — it resumes with an immediate refetch as soon as the black screen closes (`useBlackScreen`'s `onClose`).
- **White noise widget**: for each sound (White/Fan/Wave) the user has selected via `utils/homeWhiteNoiseWidgetPrefs.ts` (localStorage key `homeWidgetWhiteNoiseTypes`, defaults to all 3 sounds), shows all three duration options (♾️ Infinite/30 min/60 min via shared `utils/whiteNoiseDurations.ts` → `WHITE_NOISE_DURATION_OPTIONS`), full-width (`.btnRowFull`), same as the dedicated `/white-noise` page — the sound *selection* itself is configured on the **Settings → Home** tab (`WhiteNoiseSoundsEditor` component), not on the widget itself. Reactive playback state (`playingType`/`endAt`/`activeDuration`, including the live MM:SS countdown) comes from the shared `useWhiteNoisePlayerState()` hook, wrapping the same `whiteNoisePlayer` singleton used by `/white-noise`, so state stays in sync between the widget and the full page. Shows a "no sounds selected" note (pointing the user to Settings) when nothing is selected.
- **Sleep section**: reflects `latestSleep` from the summary call above; shows Sleeping/Awake badge with a live elapsed-time counter (JS `setInterval`, no polling). Timer counts up from `start` when sleeping, and from `end` of last sleep when awake. Clicking Start/End calls POST/PUT and re-fetches the summary.
- **Fullscreen black screen ("always on display")**: tapping/clicking the top hero emoji calls `useBlackScreen().open()`, shared with `PageLayout` (see `BlackScreenOverlay` below) — on Home it's configured with `keepAwakeMs: BLACK_SCREEN_KEEP_AWAKE_MS` so it also holds a Screen Wake Lock, unlike the plain per-page overlay. Home's own data refresh (`useRefetchOnVisible`) is paused for the whole time it's open, and refetches immediately on exit.
- **Milk — Store**: `POST /api/served-milk` with `{ amount, status: 'FRIDGE' | 'FREEZER' }`.
- **Milk — Baby drank**: `POST /api/drank-milk` with `{ amount, source }` — three buttons: **Fridge**, **Freezer**, and **Boob** (`source: 'FRIDGE' | 'FREEZER' | 'BOOB'`). For `FRIDGE`/`FREEZER` the server deducts from stored milk; `BOOB` does not touch storage.
- **Milk — Waste**: `POST /api/drank-milk/waste` with `{ amount }` — server subtracts from the latest drank record; does not touch storage.
- **Nappy**: `POST /api/poop` and `POST /api/pee`.

### `BlackScreenOverlay` (shared, `components/BlackScreenOverlay/`)
Fullscreen dimmed overlay ("always on display") rendered by **every** page — both `HomePage` (via its hero emoji button) and `PageLayout` (via its header emoji button, so all other pages get it too). Open/close behavior (fullscreen enter/exit, optional wake lock, auto-hiding exit button/cursor) lives in `utils/useBlackScreen.ts`; the overlay component itself is purely presentational plus its own data fetch:
- Fetches `GET /api/home/always-on-display` (`TAlwaysOnDisplayData`) via `utils/useAlwaysOnDisplayData.ts` — once when it opens, then every 5 minutes while it stays open, on **any** page, not just Home.
- While open, any click/tap or mouse movement shows a (`secondary` variant) **Exit** button in the corner, and that button auto-hides after 2 seconds of inactivity — the moment it hides, a dim data readout takes its place; the two never show at once, only crossfading via `opacity`. The readout is split into two positioned groups: the **current time** bottom-right at `2.8rem` (twice the size of the other fields), and **sleeping/awake duration**, **time since last pump**, and **last bottle amount + time** (or "no bottle logged") stacked top-right at `1.4rem`. Each of the four fields is individually toggleable via **Settings → Home → Black Screen** (`Checkmark` per field, `utils/blackScreenPrefs.ts` → `getHiddenBlackScreenFields`/`saveHiddenBlackScreenFields`, localStorage key `blackScreenHiddenFields`). Readout text is always white; a **Text opacity** range slider (0–100%, `getBlackScreenOpacityPercent`/`saveBlackScreenOpacityPercent`, key `blackScreenOpacity`, default `15`) controls how visible it is — the wrapping group elements handle the exit-button crossfade opacity (0/1), while each text `<span>` carries the configured opacity independently, so the two multiply together visually. Durations and the clock only ever show hours:minutes (no seconds) and re-render at most once a minute (a dedicated 60s `setInterval`).
- On `HomePage`, `useBlackScreen({ keepAwakeMs: BLACK_SCREEN_KEEP_AWAKE_MS })` also requests a Screen Wake Lock (`navigator.wakeLock`, re-requested on `visibilitychange` since the browser releases it when the tab is hidden) so the device screen doesn't turn off/lock; after `BLACK_SCREEN_KEEP_AWAKE_MS` (`client/src/config.ts`, default 120 minutes) the wake lock is released so the screen is allowed to turn off normally — the overlay and fullscreen stay open until the user taps **Exit**. On other pages (`PageLayout`, no `keepAwakeMs`), only fullscreen is used — no wake lock. Falls back silently (overlay still works, screen may still sleep) on browsers without Wake Lock API support.


### `MilkSavedPage` / `MilkDrankPage`
Both support three views via `DateRangeFilter` (stored in URL search params):
- **Item view**: flat sorted list
- **Day view**: items grouped by day; each day header is clickable and collapsed by default
- **Week view**: items grouped by Mon–Sun week; week header shows **total ml** and **~avg ml/day** (total ÷ 7); both week rows and day rows within are collapsed by default

Collapse state is local to the component (`useState<Set<string>>`).

`MilkDrankPage` shows a stats bar **below** the filter (affected by date range): total ml consumed + avg ml per day (`total ÷ days in range`). If any entry in the period has `source === 'BOOB'`, all totals and averages are marked with `*` (e.g. `340* ml`) to indicate the figure is likely inaccurate. The same `*` marker appears on day and week group headers when that group contains a BOOB entry. Item cards and expanded day rows show a source emoji (🧊 FRIDGE, ❄️ FREEZER, 🤱 BOOB).  
`MilkSavedPage` shows a stats bar **above** the filter with live fridge/freezer/total stock (not date-filtered).

### `MilestonePage` (`/milestones`) / `EditMilestonePage` (`/milestones/:id`)
- Logs baby "firsts" — title, optional description, and a date-only `DateTimeInput` (`inputType="date"`) for when it happened (defaults to today, editable)
- `MilestonePage` fetches `GET /api/milestones`, sorts by `occurredAt` date (newest first), then groups cards by month/year with a section header for each used month
- **➕ Add milestone** button toggles an inline add form (`Input` for title, `Textarea` for description, date-only `DateTimeInput`); posts to `POST /api/milestones`
- Each card shows title + date; if a description is present it's clamped to 2 lines (CSS `-webkit-line-clamp`) and clicking the card (or description) expands/collapses the full text — no extra network call
- **✏️ edit** button per card navigates to `EditMilestonePage` (`PUT`/`DELETE /api/milestones/:id`)
- Delete requires a `window.confirm(...)` before calling the API, matching `AdminBabiesPage`/`AdminUsersPage`

### `SettingsPage` (`/settings`)
Uses the `Tabs` component to split settings into five tabs (state kept local to the page, no routing):
- **👤 Account** (`SETTINGS_TAB_ACCOUNT`): self-service profile management via `PATCH /api/auth/me`, available to both `user` and `admin` roles:
  - Display name + username fields (`Input` component), saved together via **"Save profile"** (`Button`, uses `useActionFeedback` for loading/success/error state)
  - Change-password sub-form: current password + new password + confirm (all `Input type="password"`), saved via **"Change password"**; validated client-side (new password ≥ 8 chars, confirmation must match) before calling the API
  - On load, fetches `GET /api/auth/me` and syncs the result into `authStore` (`authStore.updateUser`) so the cached user stays fresh
- **🎨 Appearance** (`SETTINGS_TAB_APPEARANCE`): theme/mode/language toggles (unchanged)
- **🧭 Navigation** (`SETTINGS_TAB_NAVIGATION`): renders `NavOrderEditor` — lets the user reorder the NavBar's feature buttons (see `NavBar` docs above); Home, Settings and Logout are not shown here since they never move
- **🏠 Home** (`SETTINGS_TAB_HOME`): renders `HomeWidgetsEditor` — lets the user show/hide and reorder the HomePage widgets (see `HomePage` docs above) — plus `WhiteNoiseSoundsEditor`, which lets the user pick which sounds (White/Fan/Wave) appear in the HomePage White Noise widget; plus a **Black Screen** card with one `Checkmark` per readout field (time/sleep/pump/bottle) and a native `<input type="range">` (0–100%, styled via `accent-color`) for the readout's text opacity (see `BlackScreenOverlay` above — these prefs apply to the black screen on every page, not just Home)
- **ℹ️ About** (`SETTINGS_TAB_ABOUT`): client/server build times (unchanged)

## Utilities (`src/utils/`)

### `groupByDay<T>(items)`
Groups items by their `createdAt` date (`YYYY-MM-DD`), sorted newest-first.
Returns `{ date: string; items: T[] }[]`.

### `groupByWeek<T>(items)`
Groups items by ISO Mon–Sun week, sorted newest-first. Uses UTC date arithmetic to determine Monday of each week.
Returns `{ weekKey: string; weekLabel: string; days: { date: string; items: T[] }[] }[]`.
`weekLabel` is formatted as e.g. `"14-04 – 20-04-2026"` using `formatDate` from `format.ts`.

### `fillDayRange<T>(days, rangeFrom, rangeTo)`
Expands a `groupByDay` result into a **contiguous** descending list of every calendar day between `rangeFrom` and `rangeTo` (both `YYYY-MM-DD`, inclusive). Days without a matching group are filled with `items: []` and `taken: false`.
Returns `{ date: string; items: T[]; taken: boolean }[]`.
Used by `MedicinePage`'s day view so days a medicine dose was forgotten show up as a marked "❌ Not taken" row instead of silently disappearing, without affecting infinite-scroll pagination (which is still driven by raw log counts via `hasEnoughForView`).

## Date / Time Formatting (`src/utils/format.ts`)
All display formatting uses `Intl.DateTimeFormat` with `timeZone: 'Europe/Oslo'` and `hourCycle: 'h23'`. No locale-dependent `toLocaleString` calls in components.

| Function | Output example |
|---|---|
| `formatTime(str)` | `14:30` |
| `formatDate(str)` | `14-04-2026` |
| `formatDateTime(str)` | `14-04-2026 14:30` |
| `formatDateWithWeekday(str, includeYear?)` | `Tue 14-04-2026` / `Tue 14-04` |

## White Noise (`src/pages/WhiteNoisePage/`, `src/utils/whiteNoise.ts`)
`/white-noise` renders four sound cards — **White**, **Fan**, **Wave** (rising & falling), and **Mother's Hush** — each generated live in the browser via the Web Audio API (`AudioContext` + `AudioBufferSourceNode`, looped). No audio files are shipped or downloaded.

- `src/utils/whiteNoise.ts` exports a `whiteNoisePlayer` singleton (`WhiteNoisePlayer` class) that:
  - Lazily synthesizes a ~5s `AudioBuffer` per noise type and caches it (white = random samples; fan = double low-pass-filtered noise + faint 120Hz motor hum; wave = filtered noise carrier with a slow one-cycle-per-buffer amplitude swell for an ocean-like rise & fall; hush = noise band-limited to ~1.2kHz–6kHz — cutting both low rumble and ultra-high hiss so it reads as a breathy human "shhh" rather than radio-static — shaped by a repeating 4s envelope: 500ms silence → 1250ms ease-in rise (smootherstep, not linear) → 500ms at max → 1250ms ease-out fall → 500ms silence).
  - `play(type, durationMinutes)` — starts looping the buffer; `durationMinutes = null` means play forever, otherwise a `setTimeout` auto-stops it.
  - `stop()` — stops/disconnects the current source; `subscribe(listener)` lets React components react to play/stop state changes; `getPlayingType()` / `getEndAt()` / `getActiveDurationMinutes()` expose current state for the UI.
  - Only one noise type plays at a time (starting a new one stops the previous).
  - Registers a Vite `import.meta.hot.dispose` hook that calls `stop()` before the module is hot-reloaded in dev, so editing `whiteNoise.ts` doesn't leave an orphaned instance looping audio that the (newly hot-reloaded) UI can no longer control.
- `src/utils/whiteNoiseDurations.ts` exports the shared `WHITE_NOISE_DURATION_OPTIONS` (♾️ Infinite / 30 min / 60 min) and `formatWhiteNoiseRemaining(endAt)` (MM:SS) used by both `WhiteNoisePage` and the HomePage white-noise widget, so every sound gets the same three length choices everywhere.
- `src/utils/useWhiteNoisePlayerState.ts` exports `useWhiteNoisePlayerState()` — a hook that subscribes to `whiteNoisePlayer` and returns `{ playingType, endAt, activeDuration }`, auto-ticking once per second while a timed duration is active so any countdown UI stays live. Used by both `WhiteNoisePage` and the HomePage widget to keep their controls in sync with the same playback state.
- `src/utils/homeWhiteNoiseWidgetPrefs.ts` exports `WHITE_NOISE_SOUNDS` (shared sound metadata: type/emoji/titleKey) plus `getSelectedWhiteNoiseTypes()`/`saveSelectedWhiteNoiseTypes()` (localStorage key `homeWidgetWhiteNoiseTypes`) — used by the Settings → Home `WhiteNoiseSoundsEditor` picker and the HomePage widget to decide which sounds appear there.
- `WhiteNoisePage.tsx` renders a card per sound with three duration buttons (♾️ Infinite, 30 min, 60 min). Pressing a button starts that duration; the pressed button itself turns into the Stop button (showing a live countdown for timed durations, or "Stop" for infinite) until pressed again or another duration is chosen. Stops playback on unmount.

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

## Internationalization (`src/i18n/`)
The client supports English (`en`) and Norwegian Bokmål (`nb`).

| File | Purpose |
|---|---|
| `src/i18n/translations.json` | Flat dictionary: `SCREAMING_SNAKE_CASE_KEY -> { en, nb }`. Every user-visible string in the app lives here — no hardcoded UI text in components/pages. |
| `src/i18n/i18n.tsx` | `TLanguage = 'en' \| 'nb'`; `getSavedLanguage()`/`saveLanguage()` (localStorage key `language`); `LanguageProvider` (React Context); `useTranslation()` hook returning `{ language, setLanguage, t }`. |

- `t(key: string, vars?: Record<string, string | number>)` looks up `key` in the current language, falling back to `en`, then to the raw key if missing. Supports `{varName}` interpolation (e.g. `t('LIST_ALL_RECORDS_LOADED', { count: 5 })` for a template like `"All {count} records loaded"`).
- `main.tsx` wraps the app in `<LanguageProvider>` (alongside `ensureInitialTheme()`), so `useTranslation()` is available in every component/page.
- The Settings page (**Appearance tab**) exposes a two-way `Toggle` (🇬🇧 English / 🇳🇴 Bokmål) that calls `setLanguage`, persisting the choice to localStorage under the `language` key.
- Adding new UI text: add a new key to `translations.json` with both languages, then reference it via `t('YOUR_KEY')` — never inline literal strings in JSX/placeholders/titles/`confirm()` calls.

## Dev Proxy
`vite.config.ts` proxies `/api/*` → `http://localhost:3000`.

## Testing
`vitest` + `@testing-library/react` (+ `jest-dom` matchers) are configured via the `test` block in `vite.config.ts` (jsdom environment, `src/setupTests.ts` loads `@testing-library/jest-dom/vitest`). Test files are co-located as `*.test.ts`/`*.test.tsx` next to the code they cover (e.g. `src/utils/groupByDay.test.ts`). Run with `npm run test -w client` (or `npm test` at the repo root, which runs all workspaces).

## Build
```
npm run build -w client   # tsc type-check + vite build → dist/public/
```
Output goes to `dist/public/` (project root), which is served by Express in production.
