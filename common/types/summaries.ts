export type TDrankMilkSummary = {
  count: number;
  totalMl: number;
  avgPerDay: number;
  hasBoob: boolean;
};

/**
 * "Today so far" vs the last-10-days average — powers the item-view stat chip on the Milk Drank
 * page and the `todayMilk` always-on-display field. `avgPerDayLast10` divides the total drunk over
 * the 10 calendar days before today by the number of those days that actually have a record
 * (not a fixed 10), matching the `avgPerDay` convention used elsewhere.
 */
export type TDrankMilkTodayStats = {
  todayMl: number;
  avgPerDayLast10: number;
  hasBoob: boolean;
};

export type TSleepSummary = {
  count: number;
  totalMs: number;
  avgMs: number;
  totalAwakeMs: number;
  avgAwakeMs: number;
};

export type TNappySummary = {
  poopCount: number;
  peeCount: number;
};

export type TPumpingSummary = {
  count: number;
  avgPerDay: number;
};

