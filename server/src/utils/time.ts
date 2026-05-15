const OSLO_TZ = 'Europe/Oslo';

const getOsloParts = (date: Date): Record<string, string> => {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: OSLO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  return Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
};

const getOsloOffset = (date: Date): string => {
  const parts = getOsloParts(date);
  const osloMs = Date.UTC(
    parseInt(parts.year),
    parseInt(parts.month) - 1,
    parseInt(parts.day),
    parseInt(parts.hour),
    parseInt(parts.minute),
    parseInt(parts.second),
  );
  const offsetMs = osloMs - date.getTime();
  const sign = offsetMs >= 0 ? '+' : '-';
  const totalMin = Math.round(Math.abs(offsetMs) / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const ensureSeconds = (str: string): string =>
  str.length < 19 ? `${str.slice(0, 16)}:00` : str.slice(0, 19);

/** Returns the current Oslo local time as `YYYY-MM-DDTHH:MM:SS` (for DB storage). */
export const nowOslo = (): string => {
  const now = new Date();
  const parts = getOsloParts(now);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
};

/**
 * Converts any datetime string to Oslo local `YYYY-MM-DDTHH:MM:SS` (for DB storage).
 * - Strings ending in `Z` or a `±HH:MM` offset are parsed as absolute UTC instants.
 * - Strings with `T` but no offset are treated as already Oslo local.
 * - Strings with a space separator (SQLite `datetime('now')` UTC format) are treated as UTC.
 */
export const toOsloLocal = (isoStr: string): string => {
  const hasExplicitTz = isoStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(isoStr);
  if (hasExplicitTz) {
    const date = new Date(isoStr);
    const parts = getOsloParts(date);
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
  }
  if (isoStr.includes('T')) {
    return ensureSeconds(isoStr);
  }
  // Space-separated UTC (old SQLite format)
  const date = new Date(`${isoStr.replace(' ', 'T')}Z`);
  const parts = getOsloParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
};

/**
 * Converts a stored Oslo local string (`YYYY-MM-DDTHH:MM:SS` or `YYYY-MM-DD HH:MM:SS`)
 * to a full ISO 8601 string with the correct Oslo UTC offset (e.g. `+01:00` or `+02:00`).
 * This is used when returning timestamps to API clients.
 */
export const toOsloIso = (localStr: string): string => {
  const normalized = ensureSeconds(localStr.replace(' ', 'T'));
  // Parse as approximate UTC to derive the Oslo offset at that calendar instant.
  // Since Oslo is UTC+1/+2, the offset is stable within any given hour.
  const approx = new Date(`${normalized}Z`);
  return `${normalized}${getOsloOffset(approx)}`;
};

/** Nullable variant of {@link toOsloIso}. */
export const toOsloIsoNullable = (localStr: string | null): string | null =>
  localStr ? toOsloIso(localStr) : null;

