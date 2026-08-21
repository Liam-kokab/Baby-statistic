import type { TMedicineWithLatestLog } from 'baby-statistic-common';

/**
 * Whether a medicine's most recent dose was logged today (local calendar date). Shared by
 * `HomePage`'s medicines widget and `BlackScreenOverlay`'s always-on-display readout so both
 * pages agree on what "taken today" means.
 */
export const isMedicineTakenToday = (m: TMedicineWithLatestLog): boolean => {
  if (!m.latestTakenAt) return false;
  const today = new Date().toLocaleDateString('sv'); // YYYY-MM-DD in local time
  return m.latestTakenAt.slice(0, 10) === today;
};

