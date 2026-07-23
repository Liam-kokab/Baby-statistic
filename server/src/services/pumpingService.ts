import type { TPumping, TPumpingSummary } from 'baby-statistic-common';
import { pumpingRepository } from '../repositories/pumpingRepository';
import type { TTimeFilter, TBabyContext } from '../types';

export const pumpingService = {
  findAll: (filter: TTimeFilter = {}, ctx: TBabyContext): TPumping[] =>
    pumpingRepository.findAll(filter, ctx.babyId),

  findSummary: (filter: TTimeFilter = {}, ctx: TBabyContext): TPumpingSummary =>
    pumpingRepository.findSummary(filter, ctx.babyId),

  findLatest: (ctx: TBabyContext): TPumping | null =>
    pumpingRepository.findLatest(ctx.babyId),

  findById: (id: number, ctx: TBabyContext): TPumping | null =>
    pumpingRepository.findById(id, ctx.babyId),

  insert: (ctx: TBabyContext): TPumping =>
    pumpingRepository.insert(ctx.babyId, ctx.userId),

  update: (id: number, data: { createdAt?: string }, ctx: TBabyContext): TPumping | null =>
    pumpingRepository.update(id, data, ctx.babyId),

  delete: (id: number, ctx: TBabyContext): boolean =>
    pumpingRepository.delete(id, ctx.babyId),
};
