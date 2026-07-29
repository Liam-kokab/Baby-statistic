import type { TNavItem } from './navItems';

const STORAGE_KEY = 'navOrder';

/** Reads the user's custom nav item order (an array of `path`s) from localStorage, if any. */
export const getSavedNavOrder = (): string[] | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((p) => typeof p === 'string')) return parsed as string[];
    return null;
  } catch (_e) {
    return null;
  }
};

export const saveNavOrder = (order: string[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch (_e) {
    // ignore
  }
};

export const clearNavOrder = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_e) {
    // ignore
  }
};

/**
 * Reorders `defaultItems` to match `savedOrder` (a list of `path`s). Items missing from
 * `savedOrder` (e.g. newly added nav items) are appended at the end, in their default order.
 */
export const applyNavOrder = (defaultItems: TNavItem[], savedOrder: string[] | null): TNavItem[] => {
  if (!savedOrder || savedOrder.length === 0) return defaultItems;
  const byPath = new Map(defaultItems.map((item) => [item.path, item]));
  const ordered: TNavItem[] = [];
  savedOrder.forEach((path) => {
    const item = byPath.get(path);
    if (item) {
      ordered.push(item);
      byPath.delete(path);
    }
  });
  byPath.forEach((item) => ordered.push(item));
  return ordered;
};

