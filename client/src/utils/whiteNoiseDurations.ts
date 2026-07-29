export type TWhiteNoiseDurationOption = {
  minutes: number | null;
  labelKey: string;
  emoji: string;
};

/** Shared duration options for white-noise playback — used by both the full `/white-noise`
 * page and the HomePage white-noise widget, so every chosen sound gets the same three
 * length choices (infinite/30 min/60 min). */
export const WHITE_NOISE_DURATION_OPTIONS: TWhiteNoiseDurationOption[] = [
  { minutes: null, labelKey: 'WHITE_NOISE_PAGE_INFINITE', emoji: '♾️' },
  { minutes: 30,   labelKey: 'WHITE_NOISE_PAGE_30_MIN',   emoji: '⏱️' },
  { minutes: 60,   labelKey: 'WHITE_NOISE_PAGE_60_MIN',   emoji: '⏱️' },
];

/** Formats the remaining time until `endAt` (epoch ms) as `MM:SS`. */
export const formatWhiteNoiseRemaining = (endAt: number): string => {
  const remainingSec = Math.max(0, Math.round((endAt - Date.now()) / 1000));
  const m = Math.floor(remainingSec / 60);
  const s = remainingSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

