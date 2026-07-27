import type { TMilestone, TPostMilestone, TUpdateMilestone } from 'baby-statistic-common';
import { milestoneRepository } from '../repositories/milestoneRepository';
import type { TTimeFilter, TBabyContext } from '../types';

export const milestoneService = {
  findAll: (filter: TTimeFilter = {}, ctx: TBabyContext): TMilestone[] =>
    milestoneRepository.findAll(filter, ctx.babyId),

  findById: (id: number, ctx: TBabyContext): TMilestone | null =>
    milestoneRepository.findById(id, ctx.babyId),

  insert: (data: TPostMilestone, ctx: TBabyContext): TMilestone =>
    milestoneRepository.insert(data, ctx.babyId, ctx.userId),

  update: (id: number, data: TUpdateMilestone, ctx: TBabyContext): TMilestone | null =>
    milestoneRepository.update(id, data, ctx.babyId),

  delete: (id: number, ctx: TBabyContext): boolean =>
    milestoneRepository.delete(id, ctx.babyId),

  getBackup: (from: string, to: string, ctx: TBabyContext): TMilestone[] =>
    milestoneRepository.getBackup(from, to, ctx.babyId),
};

