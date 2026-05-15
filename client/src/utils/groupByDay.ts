export const groupByDay = <T extends { createdAt: string }>(
  items: T[],
  keyFn: (item: T) => string = (item) => item.createdAt
): { date: string; items: T[] }[] => {
  const sorted = [...items].sort((a, b) => keyFn(b).localeCompare(keyFn(a)));
  const map = sorted.reduce<Map<string, T[]>>((acc, item) => {
    const date = keyFn(item).slice(0, 10);
    return acc.set(date, [...(acc.get(date) ?? []), item]);
  }, new Map());
  return [...map.entries()].map(([date, dayItems]) => ({ date, items: dayItems }));
};

