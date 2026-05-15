type TDayGroup<T> = { date: string; items: T[] };
export type TWeekGroup<T> = { weekKey: string; weekLabel: string; days: TDayGroup<T>[] };

import { formatDate } from './format';

const getMondayKey = (dateStr: string): string => {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const day = d.getUTCDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
};

export const groupByWeek = <T extends { createdAt: string }>(
  items: T[],
  keyFn: (item: T) => string = (item) => item.createdAt
): TWeekGroup<T>[] => {
  const sorted = [...items].sort((a, b) => keyFn(b).localeCompare(keyFn(a)));

  const dayMap = sorted.reduce<Map<string, T[]>>((acc, item) => {
    const date = keyFn(item).slice(0, 10);
    return acc.set(date, [...(acc.get(date) ?? []), item]);
  }, new Map());

  const weekMap = [...dayMap.keys()].reduce<Map<string, string[]>>((acc, date) => {
    const weekKey = getMondayKey(date);
    return acc.set(weekKey, [...(acc.get(weekKey) ?? []), date]);
  }, new Map());

  return [...weekMap.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([weekKey, dates]) => {
      const monday = new Date(`${weekKey}T12:00:00Z`);
      const sunday = new Date(`${weekKey}T12:00:00Z`);
      sunday.setUTCDate(sunday.getUTCDate() + 6);
      const mondayStr = monday.toISOString().slice(0, 10);
      const sundayStr = sunday.toISOString().slice(0, 10);
      const weekLabel = `${formatDate(mondayStr).slice(0, 5)} – ${formatDate(sundayStr)}`;
      return {
        weekKey,
        weekLabel,
        days: [...dates]
          .sort((a, b) => b.localeCompare(a))
          .map((date) => ({ date, items: dayMap.get(date) ?? [] })),
      };
    });
};

