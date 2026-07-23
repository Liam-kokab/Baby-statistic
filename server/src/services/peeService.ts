import type { TPee } from 'baby-statistic-common';
import { peeRepository } from '../repositories/peeRepository';
import type { TTimeFilter, TBabyContext } from '../types';

export const peeService = {
  findAll: (filter: TTimeFilter = {}, ctx: TBabyContext): TPee[] =>
    peeRepository.findAll(filter, ctx.babyId),

  findById: (id: number, ctx: TBabyContext): TPee | null =>
    peeRepository.findById(id, ctx.babyId),

  insert: (ctx: TBabyContext): TPee =>
    peeRepository.insert(ctx.babyId, ctx.userId),

  update: (id: number, data: { createdAt?: string }, ctx: TBabyContext): TPee | null =>
    peeRepository.update(id, data, ctx.babyId),

  delete: (id: number, ctx: TBabyContext): boolean =>
    peeRepository.delete(id, ctx.babyId),

  getBackup: (from: string, to: string, ctx: TBabyContext): TPee[] =>
    peeRepository.getBackup(from, to, ctx.babyId),
};
