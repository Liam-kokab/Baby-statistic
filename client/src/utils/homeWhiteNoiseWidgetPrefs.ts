import type { TNoiseType } from './whiteNoise';

const STORAGE_KEY = 'homeWidgetWhiteNoiseTypes';

const ALL_TYPES: TNoiseType[] = ['white', 'fan', 'wave', 'hush'];

export type TWhiteNoiseSound = {
  type: TNoiseType;
  emoji: string;
  titleKey: string;
};

/** Shared sound metadata used by both the HomePage widget and the Settings → Home sound picker. */
export const WHITE_NOISE_SOUNDS: TWhiteNoiseSound[] = [
  { type: 'white', emoji: '📻', titleKey: 'WHITE_NOISE_PAGE_WHITE' },
  { type: 'fan',   emoji: '🌀', titleKey: 'WHITE_NOISE_PAGE_FAN'   },
  { type: 'wave',  emoji: '🌊', titleKey: 'WHITE_NOISE_PAGE_WAVE'  },
  { type: 'hush',  emoji: '🤫', titleKey: 'WHITE_NOISE_PAGE_HUSH'  },
];

const isNoiseType = (value: unknown): value is TNoiseType =>
  value === 'white' || value === 'fan' || value === 'wave' || value === 'hush';

/** Reads which white-noise sounds the user has chosen (Settings → Home tab) to show in the
 * HomePage widget. Defaults to all three sounds until the user customizes the selection. */
export const getSelectedWhiteNoiseTypes = (): TNoiseType[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return ALL_TYPES;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every(isNoiseType)) return parsed as TNoiseType[];
    return ALL_TYPES;
  } catch (_e) {
    return ALL_TYPES;
  }
};

export const saveSelectedWhiteNoiseTypes = (types: TNoiseType[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(types));
  } catch (_e) {
    // ignore
  }
};



