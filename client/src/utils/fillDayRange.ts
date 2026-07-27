export type TDayGroup<T> = { date: string; items: T[] };
export type TFilledDayGroup<T> = { date: string; items: T[]; taken: boolean };

/**
 * Expands a `groupByDay` result into a contiguous, descending list of every
 * calendar day between `rangeFrom` and `rangeTo` (inclusive, both YYYY-MM-DD).
 * Days without a matching group are filled with an empty `items` array and
 * `taken: false`, so gaps (e.g. a forgotten medicine dose) are easy to spot.
 */
export const fillDayRange = <T>(
  days: TDayGroup<T>[],
  rangeFrom: string,
  rangeTo: string,
): TFilledDayGroup<T>[] => {
  if (rangeFrom > rangeTo) return [];
  const byDate = new Map(days.map((d) => [d.date, d.items]));
  const result: TFilledDayGroup<T>[] = [];
  const cursor = new Date(`${rangeTo}T12:00:00`);
  const stop = new Date(`${rangeFrom}T12:00:00`);
  while (cursor >= stop) {
    const date = cursor.toISOString().slice(0, 10);
    const items = byDate.get(date) ?? [];
    result.push({ date, items, taken: items.length > 0 });
    cursor.setDate(cursor.getDate() - 1);
  }
  return result;
};

