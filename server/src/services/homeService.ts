import type { THomeSummary, TAlwaysOnDisplayData } from 'baby-statistic-common';
import { sleepService } from './sleepService';
import { drankMilkService } from './drankMilkService';
import { pumpingService } from './pumpingService';
import { medicineService } from './medicineService';
import { peeRepository } from '../repositories/peeRepository';
import { poopRepository } from '../repositories/poopRepository';
import type { TBabyContext } from '../types';

/** Latest pee/poop timestamp, whichever is more recent — mirrors GET /api/nappy/latest. */
const findLatestNappy = (ctx: TBabyContext): { createdAt: string } | null => {
  const latestPee = peeRepository.findLatest(ctx.babyId);
  const latestPoop = poopRepository.findLatest(ctx.babyId);
  const candidates: { createdAt: string }[] = [
    ...(latestPee ? [latestPee] : []),
    ...(latestPoop ? [latestPoop] : []),
  ];
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
};

export const homeService = {
  /** Everything the Home page needs on first load / background refresh, in one call. */
  getSummary: (ctx: TBabyContext): THomeSummary => ({
    latestSleep: sleepService.findLatest(ctx),
    latestDrank: drankMilkService.findLatest(ctx),
    suggestedAmount: drankMilkService.suggestNextDrinkAmount(ctx),
    latestPumping: pumpingService.findLatest(ctx),
    latestNappy: findLatestNappy(ctx),
    medicines: medicineService.findAllActive(ctx),
  }),

  /** Lightweight subset shown on the always-on-display (black screen) readout, on every page. */
  getAlwaysOnDisplay: (ctx: TBabyContext): TAlwaysOnDisplayData => ({
    latestSleep: sleepService.findLatest(ctx),
    latestPumping: pumpingService.findLatest(ctx),
    latestDrank: drankMilkService.findLatest(ctx),
  }),
};


