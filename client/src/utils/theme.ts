export type TTheme = 'girl' | 'neutral' | 'boy';
export type TThemeMode = 'light' | 'auto' | 'dark';

const STORAGE_KEY = 'theme';
const STORAGE_KEY_MODE = 'themeMode';

let mq: MediaQueryList | null = null;
let mqListener: ((e: MediaQueryListEvent) => void) | null = null;

export const getSavedTheme = (): TTheme | null => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'girl' || v === 'neutral' || v === 'boy') return v as TTheme;
    return null;
  } catch (_e) {
    return null;
  }
};

export const saveTheme = (theme: TTheme): void => {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch (_e) {
    // ignore
  }
};

export const getSavedMode = (): TThemeMode | null => {
  try {
    const v = localStorage.getItem(STORAGE_KEY_MODE);
    if (v === 'light' || v === 'auto' || v === 'dark') return v as TThemeMode;
    return null;
  } catch (_e) {
    return null;
  }
};

export const saveMode = (mode: TThemeMode): void => {
  try {
    localStorage.setItem(STORAGE_KEY_MODE, mode);
  } catch (_e) {
    // ignore
  }
};

const isSystemDark = (): boolean => {
  try {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch (_e) {
    return false;
  }
};

const resolveDark = (mode: TThemeMode): boolean => {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return isSystemDark();
};

const clearAllThemeClasses = (el: HTMLElement): void => {
  el.classList.remove('theme-girl', 'theme-neutral', 'theme-boy', 'theme-girl-dark', 'theme-neutral-dark', 'theme-boy-dark');
};

const applyEffectiveTheme = (theme: TTheme, dark: boolean): void => {
  const el = document.documentElement;
  clearAllThemeClasses(el);
  const cls = dark ? `theme-${theme}-dark` : `theme-${theme}`;
  el.classList.add(cls);
  // update the meta theme-color to match the current --color-primary
  try {
    const cs = getComputedStyle(el);
    const primary = cs.getPropertyValue('--color-primary').trim() || '';
    if (primary) {
      let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
      }
      meta.content = primary;
    }
  } catch (_e) {
    // ignore if running in environments without DOM
  }
};

export const setTheme = (theme: TTheme): void => {
  saveTheme(theme);
  // persist theme in a cookie so server can serve a matching manifest.json at install time
  try { document.cookie = `theme=${theme}; path=/; max-age=${60 * 60 * 24 * 365}`; } catch (_e) {}
  const mode = getSavedMode() ?? 'auto';
  const dark = resolveDark(mode);
  applyEffectiveTheme(theme, dark);
};

export const setMode = (mode: TThemeMode): void => {
  saveMode(mode);
  // persist mode in a cookie so server can use it when returning manifest.json
  try { document.cookie = `themeMode=${mode}; path=/; max-age=${60 * 60 * 24 * 365}`; } catch (_e) {}
  // remove existing listener
  if (mq && mqListener) {
    try { mq.removeEventListener('change', mqListener); } catch (_e) { try { mq.removeListener(mqListener as any); } catch (_e2) {} }
    mq = null;
    mqListener = null;
  }

  if (mode === 'auto') {
    try {
      mq = window.matchMedia('(prefers-color-scheme: dark)');
      mqListener = () => {
        const theme = getSavedTheme() ?? 'neutral';
        applyEffectiveTheme(theme, mq?.matches ?? false);
      };
      // modern API
      if (mq.addEventListener) mq.addEventListener('change', mqListener);
      else mq.addListener(mqListener as any);
    } catch (_e) {
      mq = null;
      mqListener = null;
    }
  }

  // apply with current theme
  const theme = getSavedTheme() ?? 'neutral';
  const dark = resolveDark(mode);
  applyEffectiveTheme(theme, dark);
};

export const themeToIndex = (t: TTheme): number => (t === 'girl' ? 0 : t === 'neutral' ? 1 : 2);

export const indexToTheme = (i: number): TTheme => (i === 1 ? 'neutral' : i === 2 ? 'boy' : 'girl');

export const modeToIndex = (m: TThemeMode): number => (m === 'light' ? 0 : m === 'auto' ? 1 : 2);

export const indexToMode = (i: number): TThemeMode => (i === 0 ? 'light' : i === 2 ? 'dark' : 'auto');

export const ensureInitialTheme = (): void => {
  const savedTheme = getSavedTheme() ?? 'neutral';
  const savedMode = getSavedMode() ?? 'auto';
  // ensure any listeners and classes are set
  setMode(savedMode);
  setTheme(savedTheme);
};

