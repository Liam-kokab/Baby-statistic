import type { TView } from '../components/DateRangeFilter/DateRangeFilter';

const getMondayOf = (dateStr: string): string => {
  const d = new Date(`${dateStr}T12:00:00`);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
};

/**
 * Returns true when `items` contain at least `minGroups` distinct groups
 * for the given view (items = raw count, day = distinct days, week = distinct weeks).
 */
export const hasEnoughForView = <T>(
  items: T[],
  view: TView,
  getDate: (item: T) => string,
  minGroups = 10,
): boolean => {
  if (view === 'item') return items.length >= minGroups;
  const toKey =
    view === 'week'
      ? (i: T) => getMondayOf(getDate(i).slice(0, 10))
      : (i: T) => getDate(i).slice(0, 10);
  return new Set(items.map(toKey)).size >= minGroups;
};

