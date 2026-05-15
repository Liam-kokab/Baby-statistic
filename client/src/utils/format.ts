const OSLO = 'Europe/Oslo';

type TDateParts = {
  year: string;
  month: string;
  day: string;
  weekday: string;
  hour: string;
  minute: string;
};

const getOsloParts = (str: string): TDateParts => {
  const d = new Date(str);
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: OSLO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });
  return Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value])) as TDateParts;
};

/** `HH:MM` in 24-hour Oslo time. */
export const formatTime = (str: string): string => {
  const { hour, minute } = getOsloParts(str);
  return `${hour}:${minute}`;
};

/** `DD-MM-YYYY` in Oslo time. */
export const formatDate = (str: string): string => {
  const { day, month, year } = getOsloParts(str);
  return `${day}-${month}-${year}`;
};

/** `DD-MM-YYYY HH:MM` in 24-hour Oslo time. */
export const formatDateTime = (str: string): string => {
  const { day, month, year, hour, minute } = getOsloParts(str);
  return `${day}-${month}-${year} ${hour}:${minute}`;
};

/**
 * `Mon 14-04-2026` or `Mon 14-04` (when `includeYear` is false).
 * Day-of-week is derived from Oslo local time.
 */
export const formatDateWithWeekday = (str: string, includeYear = true): string => {
  const { day, month, year, weekday } = getOsloParts(str);
  const date = includeYear ? `${day}-${month}-${year}` : `${day}-${month}`;
  return `${weekday} ${date}`;
};

