import type { THomeWidgetItem } from './homeWidgets';
import { DEFAULT_HIDDEN_HOME_WIDGETS } from './homeWidgets';

const ORDER_STORAGE_KEY = 'homeWidgetOrder';
const HIDDEN_STORAGE_KEY = 'homeWidgetHidden';

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

/** Reads the user's custom HomePage widget order (an array of `key`s) from localStorage, if any. */
export const getSavedHomeWidgetOrder = (): string[] | null => readStringArray(ORDER_STORAGE_KEY);

export const saveHomeWidgetOrder = (order: string[]): void => writeStringArray(ORDER_STORAGE_KEY, order);

export const clearHomeWidgetOrder = (): void => {
  try {
    localStorage.removeItem(ORDER_STORAGE_KEY);
  } catch (_e) {
    // ignore
  }
};

/** Reads the set of widget `key`s the user has hidden from the HomePage. Falls back to
 * `DEFAULT_HIDDEN_HOME_WIDGETS` (e.g. `whiteNoise`) until the user has saved a preference —
 * even an explicitly-empty saved array (everything unhidden) is respected. */
export const getHiddenHomeWidgets = (): string[] => readStringArray(HIDDEN_STORAGE_KEY) ?? DEFAULT_HIDDEN_HOME_WIDGETS;

export const saveHiddenHomeWidgets = (hidden: string[]): void => writeStringArray(HIDDEN_STORAGE_KEY, hidden);

export const clearHiddenHomeWidgets = (): void => {
  try {
    localStorage.removeItem(HIDDEN_STORAGE_KEY);
  } catch (_e) {
    // ignore
  }
};

/**
 * Reorders `defaultItems` to match `savedOrder` (a list of `key`s). Items missing from
 * `savedOrder` (e.g. newly added widgets) are appended at the end, in their default order.
 */
export const applyHomeWidgetOrder = (defaultItems: THomeWidgetItem[], savedOrder: string[] | null): THomeWidgetItem[] => {
  if (!savedOrder || savedOrder.length === 0) return defaultItems;
  const byKey = new Map(defaultItems.map((item) => [item.key, item]));
  const ordered: THomeWidgetItem[] = [];
  savedOrder.forEach((key) => {
    const item = byKey.get(key as THomeWidgetItem['key']);
    if (item) {
      ordered.push(item);
      byKey.delete(item.key);
    }
  });
  byKey.forEach((item) => ordered.push(item));
  return ordered;
};

