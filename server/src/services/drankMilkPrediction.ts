import type { TDrankMilk } from 'baby-statistic-common';
import { drankMilkRepository } from '../repositories/drankMilkRepository';
import { nowOslo, toOsloLocal } from '../utils/time';
import configFile from '../config/config.json';

type TPredictOptions = {
  lookbackDays?: number;
  weeks?: number;
  roundingStep?: number;
  maxReduction?: number;
  halfLifeWeeks?: number;
  minSamplesPerBucket?: number;
  reductionExponent?: number;
};

const DRANK_CFG = (configFile && (configFile.drankMilk ?? {})) as Record<string, unknown>;
const FILE_SETTINGS = (DRANK_CFG && (DRANK_CFG.prediction ?? {})) as Record<string, unknown>;
const DEFAULTS: Required<TPredictOptions> = {
  lookbackDays: Number(FILE_SETTINGS.lookbackDays ?? 35),
  weeks: Number(FILE_SETTINGS.weeks ?? 5),
  roundingStep: Number(FILE_SETTINGS.roundingStep ?? 10),
  maxReduction: Number(FILE_SETTINGS.maxReduction ?? 0.3),
  halfLifeWeeks: Number(FILE_SETTINGS.halfLifeWeeks ?? 2),
  minSamplesPerBucket: Number(FILE_SETTINGS.minSamplesPerBucket ?? 2),
  reductionExponent: Number(FILE_SETTINGS.reductionExponent ?? 2),
};

const msPerDay = 24 * 60 * 60 * 1000;
const msPerWeek = 7 * msPerDay;
const msPerHour = 60 * 60 * 1000;

const median = (arr: number[]): number | null => {
  if (!arr || arr.length === 0) return null;
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 === 1 ? a[m] : (a[m - 1] + a[m]) / 2;
};

const roundToStep = (value: number, step: number): number =>
  Math.max(0, Math.round(value / step) * step);

const getOsloHourFromCreatedAt = (createdAtIso: string): number => {
  // createdAtIso is produced by repository as an ISO with offset (e.g. 2026-05-27T12:34:00+02:00)
  // Extract the local hour portion (positions 11..13 in the string YYYY-MM-DDTHH)
  // Fallback to parsing if string length unexpected.
  try {
    if (createdAtIso.length >= 13) {
      return Number(createdAtIso.slice(11, 13));
    }
    return new Date(createdAtIso).getUTCHours();
  } catch (_e) {
    return 0;
  }
};

export type TSuggestionDetails = {
  suggested: number;
  raw: number;
  observedMax: number;
  recencyFactor: number;
  roundingStep: number;
  reductionPercent: number;
};

export const getSuggestedNextDrinkDetails = (opts: TPredictOptions = {}): TSuggestionDetails => {
  const {
    lookbackDays,
    weeks,
    roundingStep,
    maxReduction,
    halfLifeWeeks,
    minSamplesPerBucket,
    reductionExponent,
  } = { ...DEFAULTS, ...opts } as Required<TPredictOptions>;

  // Build time window
  const toLocal = nowOslo();
  const fromDate = new Date(Date.now() - lookbackDays * msPerDay);
  const fromLocal = toOsloLocal(fromDate.toISOString());

  const records: TDrankMilk[] = drankMilkRepository.getBackup(fromLocal, toLocal);
  if (!records || records.length === 0)
    return { suggested: 0, raw: 0, observedMax: 0, recencyFactor: 1, roundingStep, reductionPercent: 0 };

  // Observed max single-bottle amount in window
  const observedMax = records.reduce((acc, r) => Math.max(acc, r.amount), 0);
  if (observedMax <= 0) return { suggested: 0, raw: 0, observedMax: 0, recencyFactor: 1, roundingStep, reductionPercent: 0 };

  // Determine reference bucket from the latest record
  const latest = records.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
  const refHour = getOsloHourFromCreatedAt(latest.createdAt);
  const bucketHours = Number(((DRANK_CFG.bucket as any)?.hours) ?? 2);
  const refBucket = Math.floor(refHour / bucketHours); // e.g. 0..(24/bucketHours - 1)

  // Build weekly windows (newest first)
  const nowMs = Date.now();
  const weekPredictions: (number | null)[] = [];

  for (let i = 0; i < weeks; i++) {
    const endMs = nowMs - i * msPerWeek;
    const startMs = endMs - msPerWeek;
    const weekRecords = records.filter(r => {
      const d = new Date(r.createdAt).getTime();
      return d >= startMs && d < endMs;
    });

    if (weekRecords.length === 0) {
      weekPredictions.push(null);
      continue;
    }

    // Build amounts per bucket
    const bucketsCount = Math.ceil(24 / bucketHours);
    const bucketAmounts: number[][] = Array.from({ length: bucketsCount }, () => []);
    for (const r of weekRecords) {
      const h = getOsloHourFromCreatedAt(r.createdAt);
      const idx = Math.floor(h / bucketHours);
      bucketAmounts[idx]!.push(r.amount);
    }

    const refBucketSamples = bucketAmounts[refBucket] ?? [];
    let predictionForWeek: number | null = null;
    if (refBucketSamples.length >= minSamplesPerBucket) {
      const med = median(refBucketSamples as number[]);
      predictionForWeek = med;
    } else {
      // Fallback to week's overall median (robust to outliers)
      const all = weekRecords.map(r => r.amount);
      predictionForWeek = median(all);
    }

    weekPredictions.push(predictionForWeek);
  }

  // If all weeks empty, return 0
  const available = weekPredictions.filter(v => v !== null) as number[];
  if (available.length === 0) return { suggested: 0, raw: 0, observedMax: 0, recencyFactor: 1, roundingStep, reductionPercent: 0 };

  // Combine with exponential recency weights (newest week index 0)
  const lambda = Math.log(2) / halfLifeWeeks;
  const rawWeights = Array.from({ length: weeks }, (_, i) => Math.exp(-lambda * i));

  // Normalize weights only across weeks that have data
  const availableIndices = weekPredictions.map((v, i) => (v !== null ? i : -1)).filter(i => i !== -1) as number[];
  const availableWeightSum = availableIndices.reduce((s, i) => s + rawWeights[i], 0);
  let combined = 0;
  if (availableWeightSum > 0) {
    for (const i of availableIndices) {
      const pred = weekPredictions[i] as number;
      const w = rawWeights[i] / availableWeightSum;
      combined += pred * w;
    }
  }

  // Ensure not bigger than observed max
  combined = Math.min(combined, observedMax);
  // Apply recency adjustment: if the baby drank recently, expect less next time.
  const recentSettings = (DRANK_CFG.recency ?? {}) as Record<string, number>;
  const decayHours = Number(recentSettings.decayHours ?? 4);
  const minFactor = Number(recentSettings.minFactor ?? 0.5);
  const latestMs = new Date(latest.createdAt).getTime();
  const elapsedHours = Math.max(0, (Date.now() - latestMs) / msPerHour);
  const recencyFrac = Math.min(1, elapsedHours / decayHours);
  const recencyFactor = minFactor + (1 - minFactor) * recencyFrac;
  combined = combined * recencyFactor;

  // Shrink amount a bit to avoid waste. Closer to max => larger reduction up to maxReduction.
  const closeness = Math.max(0, Math.min(1, combined / observedMax));
  const reductionPercent = maxReduction * Math.pow(closeness, reductionExponent);
  const adjusted = combined * (1 - reductionPercent);

  const rounded = roundToStep(adjusted, roundingStep);
  // Final clamp
  const final = Math.max(0, Math.min(observedMax, rounded));

  return {
    suggested: final,
    raw: combined,
    observedMax,
    recencyFactor,
    roundingStep,
    reductionPercent,
  };
};

export const getSuggestedNextDrinkAmount = (opts: TPredictOptions = {}): number =>
  getSuggestedNextDrinkDetails(opts).suggested;

export default getSuggestedNextDrinkDetails;


