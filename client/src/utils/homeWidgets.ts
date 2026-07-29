export type THomeWidgetKey = 'sleep' | 'milk' | 'nappy' | 'medicines' | 'whiteNoise';

export type THomeWidgetItem = {
  key: THomeWidgetKey;
  labelKey: string;
};

/** Default HomePage widget order — all visible except `whiteNoise`, which is opt-in.
 * Used as the fallback when the user hasn't customized anything (Settings → Home tab). */
export const DEFAULT_HOME_WIDGETS: THomeWidgetItem[] = [
  { key: 'sleep',      labelKey: 'HOME_SLEEP_TITLE'      },
  { key: 'milk',       labelKey: 'HOME_MILK_TITLE'       },
  { key: 'nappy',      labelKey: 'HOME_NAPPY_TITLE'      },
  { key: 'medicines',  labelKey: 'HOME_MEDICINES_TITLE'  },
  { key: 'whiteNoise', labelKey: 'HOME_WHITE_NOISE_TITLE' },
];

/** Widgets hidden by default until the user explicitly enables them on the Settings → Home tab. */
export const DEFAULT_HIDDEN_HOME_WIDGETS: THomeWidgetKey[] = ['whiteNoise'];


