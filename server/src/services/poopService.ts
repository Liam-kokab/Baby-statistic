import type { TPoop } from 'baby-statistic-common';
import { poopRepository } from '../repositories/poopRepository';
import type { TTimeFilter, TBabyContext } from '../types';

export const poopService = {
  findAll: (filter: TTimeFilter = {}, ctx: TBabyContext): TPoop[] =>
    poopRepository.findAll(filter, ctx.babyId),

  findById: (id: number, ctx: TBabyContext): TPoop | null =>
    poopRepository.findById(id, ctx.babyId),

  insert: (ctx: TBabyContext): TPoop =>
    poopRepository.insert(ctx.babyId, ctx.userId),

  update: (id: number, data: { createdAt?: string }, ctx: TBabyContext): TPoop | null =>
    poopRepository.update(id, data, ctx.babyId),

  delete: (id: number, ctx: TBabyContext): boolean =>
    poopRepository.delete(id, ctx.babyId),

  getBackup: (from: string, to: string, ctx: TBabyContext): TPoop[] =>
    poopRepository.getBackup(from, to, ctx.babyId),
};
