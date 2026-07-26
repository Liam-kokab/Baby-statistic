import type { TPumping, TPumpingSummary } from 'baby-statistic-common';
import { pumpingRepository } from '../repositories/pumpingRepository';
import type { TTimeFilter, TBabyContext } from '../types';
import { createSimpleEventService } from './simpleEventServiceFactory';

const base = createSimpleEventService<TPumping>(pumpingRepository);

export const pumpingService = {
  ...base,

  findSummary: (filter: TTimeFilter = {}, ctx: TBabyContext): TPumpingSummary =>
    pumpingRepository.findSummary(filter, ctx.babyId),

  findLatest: (ctx: TBabyContext): TPumping | null =>
    pumpingRepository.findLatest(ctx.babyId),
};
