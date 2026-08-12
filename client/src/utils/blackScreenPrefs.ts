export type TBlackScreenField = 'time' | 'sleep' | 'pump' | 'bottle';

/** All data fields shown on the black screen readout, in display order. */
export const BLACK_SCREEN_FIELDS: TBlackScreenField[] = ['time', 'sleep', 'pump', 'bottle'];

const HIDDEN_FIELDS_STORAGE_KEY = 'blackScreenHiddenFields';
const OPACITY_STORAGE_KEY = 'blackScreenOpacity';

/** Default readout opacity (%) — low enough to stay unobtrusive against the black overlay. */
const DEFAULT_OPACITY_PERCENT = 15;

const readStringArray = (key: string): string[] | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((p) => typeof p === 'string')) return parsed as string[];
    return null;
  } catch (_e) {
    return null;
  }
};

const writeStringArray = (key: string, value: string[]): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_e) {
    // ignore
  }
};

/** Reads the set of black-screen data fields the user has hidden. Defaults to none hidden
 * (all fields shown) until the user explicitly hides one. */
export const getHiddenBlackScreenFields = (): TBlackScreenField[] =>
  (readStringArray(HIDDEN_FIELDS_STORAGE_KEY) ?? []).filter((f): f is TBlackScreenField =>
    BLACK_SCREEN_FIELDS.includes(f as TBlackScreenField)
  );

export const saveHiddenBlackScreenFields = (hidden: TBlackScreenField[]): void =>
  writeStringArray(HIDDEN_FIELDS_STORAGE_KEY, hidden);

/** Reads the black-screen readout's opacity, as a whole percentage (0–100). The readout text is
 * always white — this opacity is what keeps it unobtrusive against the black overlay. */
export const getBlackScreenOpacityPercent = (): number => {
  try {
    const raw = localStorage.getItem(OPACITY_STORAGE_KEY);
    if (raw === null) return DEFAULT_OPACITY_PERCENT;
    const n = Number(raw);
    if (!Number.isFinite(n)) return DEFAULT_OPACITY_PERCENT;
    return Math.min(100, Math.max(0, n));
  } catch (_e) {
    return DEFAULT_OPACITY_PERCENT;
  }
};

export const saveBlackScreenOpacityPercent = (percent: number): void => {
  try {
    localStorage.setItem(OPACITY_STORAGE_KEY, String(Math.min(100, Math.max(0, percent))));
  } catch (_e) {
    // ignore
  }
};


