export type TNavItem = {
  path: string;
  emoji: string;
  labelKey: string;
};

/** Always rendered as the first main-bar button for regular users — never reorderable. */
export const HOME_ITEM: TNavItem = { path: '/', emoji: '🏠', labelKey: 'NAV_HOME' };

/** Always rendered as the last item inside the arc menu (before Logout) — never reorderable. */
export const SETTINGS_ITEM: TNavItem = { path: '/settings', emoji: '⚙️', labelKey: 'NAV_SETTINGS' };

/** How many feature items are shown directly on the main bar; the rest live in the arc menu. */
export const VISIBLE_FEATURE_COUNT = 3;

/** User-reorderable feature nav items (everything except Home, Settings and Logout). */
export const USER_FEATURE_ITEMS: TNavItem[] = [
  { path: '/pumping',     emoji: '🥛', labelKey: 'NAV_PUMPING'      },
  { path: '/milk-drank',  emoji: '🍼', labelKey: 'NAV_MILK_DRANK'   },
  { path: '/sleep',       emoji: '🌙', labelKey: 'NAV_SLEEP'        },
  { path: '/poop-pee',    emoji: '💩', labelKey: 'NAV_POOP_AND_PEE' },
  { path: '/medicine',    emoji: '💊', labelKey: 'NAV_MEDICINE'     },
  { path: '/milk-saved',  emoji: '🧊', labelKey: 'NAV_MILK_SAVED'   },
  { path: '/milestones',  emoji: '🏆', labelKey: 'NAV_MILESTONES'   },
  { path: '/white-noise', emoji: '🎧', labelKey: 'NAV_WHITE_NOISE'  },
];

// ── Admin nav (not user-reorderable) ────────────────────────────────────────
export const ADMIN_MAIN_ITEMS: TNavItem[] = [
  { path: '/admin/babies', emoji: '👶', labelKey: 'NAV_BABIES' },
  { path: '/admin',        emoji: '🔑', labelKey: 'NAV_ADMIN'  },
  { path: '/admin/users',  emoji: '👥', labelKey: 'NAV_USERS'  },
];

/** Rendered in the arc menu for admins, alongside Settings — not shown on the main bar. */
export const ADMIN_API_KEYS_ITEM: TNavItem = { path: '/admin/api-keys', emoji: '🗝️', labelKey: 'NAV_API_KEYS' };


