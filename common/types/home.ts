import type { TSleep } from './sleep';
import type { TDrankMilk } from './drankMilk';
import type { TPumping } from './pumping';
import type { TMedicineWithLatestLog } from './medicine';
import type { TDrankMilkTodayStats } from './summaries';

/**
 * Aggregated payload for the Home page's first load and background refresh —
 * combines what used to be six separate requests into one call.
 */
export type THomeSummary = {
  latestSleep: TSleep | null;
  latestDrank: TDrankMilk | null;
  suggestedAmount: number | null;
  latestPumping: TPumping | null;
  latestNappy: { createdAt: string } | null;
  medicines: TMedicineWithLatestLog[];
};

/**
 * Lightweight payload for the "always on display" (black screen) readout —
 * shown on every page, refreshed when it opens and every 5 minutes after that.
 */
export type TAlwaysOnDisplayData = {
  latestSleep: TSleep | null;
  latestPumping: TPumping | null;
  latestDrank: TDrankMilk | null;
  drankToday: TDrankMilkTodayStats;
  medicines: TMedicineWithLatestLog[];
};

