import type { TDrankMilk } from 'baby-statistic-common';
import { drankMilkRepository } from '../repositories/drankMilkRepository';
import { toOsloLocal } from '../utils/time';


const msPerDay = 24 * 60 * 60 * 1000;
const msPerHour = 60 * 60 * 1000;

const getAverage = (arr : number[]): number | null => {
  if (!arr || arr.length === 0) return null;
  const sum = arr.reduce((s, v) => s + v, 0);
  return sum / arr.length;
}

/**
 * @param arr Array of objects with `value` and `weight` properties, weight >= 0,
 * @returns Weighted average of the values, or null if input is empty or invalid
 */
export const getAverageWithWeight = (arr: { value: number; weight: number }[]): number | null => {
  if (!arr || arr.length === 0) return null;

  // Keep only valid entries: finite numbers and non-negative weights
  const valid = arr.filter(
    (e) => typeof e.value === 'number' && Number.isFinite(e.value) && typeof e.weight === 'number' && Number.isFinite(e.weight) && e.weight >= 0,
  );

  if (valid.length === 0) return null;

  const totalWeight = valid.reduce((s, v) => s + v.weight, 0);
  if (totalWeight === 0) return null; // no effective weight

  const weightedSum = valid.reduce((s, v) => s + v.value * v.weight, 0);
  return weightedSum / totalWeight;
};

const roundToStep = (value: number, step: number): number =>
  Math.max(0, Math.round(value / step) * step);

export const divideDataByHours = (data: TDrankMilk[], hours: number): TDrankMilk[][] => {
  // Defensive: hours must be a positive number
  const bucketHours = typeof hours === 'number' && hours > 0 ? hours : 1;

  if (!data || data.length === 0) return [];

  // Sort by createdAt ascending (old -> new)
  const dataSorted = [...data].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const result: TDrankMilk[][] = [];

  // Choose the earliest valid timestamp as the anchor for buckets. If no valid
  // timestamps exist, fall back to the first record's timestamp (may be NaN).
  const firstValidIdx = dataSorted.findIndex((d) => Number.isFinite(new Date(d.createdAt).getTime()));
  const startTs = firstValidIdx >= 0
    ? new Date(dataSorted[firstValidIdx].createdAt).getTime()
    : new Date(dataSorted[0].createdAt).getTime();
  const bucketMs = bucketHours * msPerHour;

  for (const item of dataSorted) {
    const ts = new Date(item.createdAt).getTime();
    // Put item into the bucket based on elapsed time from the first record
    const idx = Math.floor((ts - startTs) / bucketMs);
    if (!Number.isFinite(idx) || idx < 0) {
      // Shouldn't happen for valid dates, but guard anyway by placing into first bucket
      if (result.length === 0) result.push([]);
      result[0].push(item);
      continue;
    }

    while (result.length <= idx) {
      result.push([]);
    }

    result[idx].push(item);
  }

  return result;
};

const getAndSensitizeData = (babyId: number): TDrankMilk[] => {
  // Compute time window: from 36 days ago until now + 3 hours (safety)
  const now = new Date();
  const toDate = new Date(now.getTime() + 3 * msPerHour);
  const fromDate = new Date(now.getTime() - 36 * msPerDay);

  const from = toOsloLocal(fromDate.toISOString());
  const to = toOsloLocal(toDate.toISOString());

  // Fetch records in the window (repository expects Oslo-local datetime strings)
  const raw: TDrankMilk[] = drankMilkRepository.findAll({ from, to }, babyId);
  if (!raw || raw.length === 0) return [];

  // Ensure old -> new ordering
  return [...raw].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

/**
 * Weighted average of a list of bucket totals.
 * Weights interpolate linearly from oldest = 0.5 to newest = 1.5.
 */
const weightedAverageOfTotals = (totals: number[]): number | null => {
  const n = totals.length;
  if (n === 0) return null;
  const weighted = totals.map((value, i) => {
    const weight = n === 1 ? 1 : 0.5 + (i / (n - 1)); // range [0.5, 1.5]
    return { value, weight };
  });
  return getAverageWithWeight(weighted);
};

const getWeightedAverageForPeriod = (data: TDrankMilk[], hours: number): number | null => {
  if (!data || data.length === 0) return null;

  // Divide into buckets of the requested hour length (old -> new)
  const buckets = divideDataByHours(data, hours);
  if (!buckets || buckets.length === 0) return null;

  // Compute total per bucket
  const totals: number[] = buckets.map((bucket) =>
    bucket.reduce((s, r) => s + (typeof r.amount === 'number' && Number.isFinite(r.amount) ? r.amount : 0), 0),
  );

  if (totals.length === 0) return null;

  // Two-pass average (added 2026-06-03): empty / barely-fed buckets (e.g. sleep
  // stretches) count as ~0 and drag the average well below a real feed size.
  // 1) take the weighted average once, 2) drop every bucket below half of it,
  // 3) re-take the weighted average over what remains.
  const firstPass = weightedAverageOfTotals(totals);
  if (firstPass === null) return null;

  const kept = totals.filter((t) => t >= 0.5 * firstPass);
  if (kept.length === 0) return firstPass;

  return weightedAverageOfTotals(kept);
};

const getLatestHours = (data: TDrankMilk[], hours: number): number => {
  if (!data || data.length === 0) return 0;
  const hrs = typeof hours === 'number' && hours > 0 ? hours : 0;
  if (hrs === 0) return 0;

  const now = new Date();
  const cutoffMs = now.getTime() - hrs * msPerHour;

  return data.filter((d) => {
    const ts = new Date(d.createdAt).getTime();
    return Number.isFinite(ts) && ts >= cutoffMs && ts <= now.getTime();
  }).reduce((s, r) => s + (typeof r.amount === 'number' && Number.isFinite(r.amount) ? r.amount : 0), 0);
};

const getPredictionForPeriodLength = (data: TDrankMilk[], hours: number): number | null => {
  // Get weighted average for the period
  const wa = getWeightedAverageForPeriod(data, hours);
  if (wa === null) return null;

  const drankInLastHours = getLatestHours(data, hours);

  // The prediction is the weighted average for the period minus what was already drank in the last X hours, since the average includes that. This way we "reset" the prediction based on recent drinking.
  const pred = wa - drankInLastHours;
  // Ensure prediction is not negative
  return pred > 0 ? pred : 0;
};

export const reduceSuggestionToAvoidWaste = (data: TDrankMilk[], raw: number): number => {
  if (!raw || raw <= 0) return raw;

  const fiveBiggestNumbers = [...data]
    .map((d) => (typeof d.amount === 'number' && Number.isFinite(d.amount) ? d.amount : 0))
    .sort((a, b) => a - b)
    .slice(-5);

  const max = getAverage(fiveBiggestNumbers);
  if (!max) return raw;

  const normalizedRaw = Math.min(raw, max);

  // closeness in [0,1]
  const closeness = normalizedRaw / max;

  // Reduce up to 33% proportional to closeness
  const maxReduction = 0.33;
  const reductionFactor = closeness * maxReduction;

  const adjusted = normalizedRaw * (1 - reductionFactor);
  return Math.max(0, Math.round(adjusted));
};

export type TSuggestionDetails = {
  suggestion: number;
  raw: number;
  suggestBasedOnTwoHour: number;
  suggestBasedOnFourHour: number;
  suggestBasedOnSixHour: number;
};

const getSuggestedNextDrinkDetails = (babyId: number): TSuggestionDetails => {
  // Get cleaned historical data
  const data = getAndSensitizeData(babyId);

  const suggestBasedOnTwoHour = getPredictionForPeriodLength(data, 2) ?? 0;
  const suggestBasedOnFourHour = getPredictionForPeriodLength(data, 4) ?? 0;
  const suggestBasedOnSixHour = getPredictionForPeriodLength(data, 6) ?? 0;

  // Combine the short-term estimates; prefer recent behavior by weighting shorter windows slightly higher
  const combined = getAverageWithWeight([
    { value: suggestBasedOnTwoHour, weight: 1.5 },
    { value: suggestBasedOnFourHour, weight: 1.2 },
    { value: suggestBasedOnSixHour, weight: 1.0 },
  ]) ?? 0;

  const reducedValue = reduceSuggestionToAvoidWaste(data, combined);

  return {
    suggestion: roundToStep(reducedValue, 10),
    raw: roundToStep(combined, 10),
    suggestBasedOnTwoHour: roundToStep(suggestBasedOnTwoHour, 10),
    suggestBasedOnFourHour: roundToStep(suggestBasedOnFourHour, 10),
    suggestBasedOnSixHour: roundToStep(suggestBasedOnSixHour, 10),
  };
};

export const getSuggestedNextDrinkAmount = (babyId: number): number =>
  getSuggestedNextDrinkDetails(babyId).suggestion;

export default getSuggestedNextDrinkDetails;


