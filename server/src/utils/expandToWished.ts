import type { TWishedResult } from 'baby-statistic-common';

const MAX_WEEKS = 200; // safety cap (~4 years)

const getMondayOf = (dateStr: string): string => {
  const d = new Date(`${dateStr}T12:00:00`);
  const day = d.getDay();
  const daysBack = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().slice(0, 10);
};

/**
 * Expands a list query backward by one Mon–Sun week at a time until
 * `wished` items are found or the `requestedFrom` boundary is reached.
 *
 * @param wished        - Minimum desired item count.
 * @param requestedFrom - ISO datetime lower bound (e.g. "2026-03-11T00:00:00"), or "" for none.
 * @param to            - ISO datetime upper bound (e.g. "2026-06-15T23:59:59").
 * @param fetchFn       - Function that fetches items for a given from/to ISO datetime range.
 *                        Items are expected in DESC order (newest first).
 * @returns             `{ items, actualFrom }` where `actualFrom` is YYYY-MM-DD.
 */
export const expandToWished = <T>(
  wished: number,
  requestedFrom: string,
  to: string,
  fetchFn: (from: string, to: string) => T[],
): TWishedResult<T> => {
  const toDate = to.slice(0, 10);
  const fromDate = requestedFrom ? requestedFrom.slice(0, 10) : '';

  let windowStart = getMondayOf(toDate);
  if (fromDate && windowStart < fromDate) windowStart = fromDate;

  let items = fetchFn(`${windowStart}T00:00:00`, to);
  let currentFrom = windowStart;

  let iterations = 0;
  while (items.length < wished && (!fromDate || currentFrom > fromDate) && iterations < MAX_WEEKS) {
    iterations++;

    // Sunday immediately before currentFrom
    const prevSunDate = new Date(`${currentFrom}T12:00:00`);
    prevSunDate.setDate(prevSunDate.getDate() - 1);
    const prevSun = prevSunDate.toISOString().slice(0, 10);

    // Monday of that Sunday's week
    const prevMonDate = new Date(`${prevSun}T12:00:00`);
    prevMonDate.setDate(prevMonDate.getDate() - 6);
    const prevMon = prevMonDate.toISOString().slice(0, 10);

    const clampedFrom = fromDate && prevMon < fromDate ? fromDate : prevMon;

    const moreItems = fetchFn(`${clampedFrom}T00:00:00`, `${prevSun}T23:59:59`);
    // Append older items at end (data is DESC: newest first)
    items = [...items, ...moreItems];
    currentFrom = clampedFrom;

    if (fromDate && clampedFrom <= fromDate) break;
    // Safety: if no lower bound and no data in this extra week, stop
    if (!fromDate && moreItems.length === 0) break;
  }

  return { items, actualFrom: currentFrom };
};

