import type { TSleep, TPostSleep, TSleepSummary } from 'baby-statistic-common';
import { sleepRepository } from '../repositories/sleepRepository';
import type { TTimeFilter, TBabyContext } from '../types';

export const sleepService = {
  findAll: (filter: TTimeFilter = {}, ctx: TBabyContext): TSleep[] =>
    sleepRepository.findAll(filter, ctx.babyId),

  findSummary: (filter: TTimeFilter = {}, ctx: TBabyContext): TSleepSummary => {
    const agg = sleepRepository.findSummaryAgg(filter, ctx.babyId);
    const ordered = sleepRepository.findOrderedForRange(filter, ctx.babyId);
    const gaps = ordered.reduce<number[]>((acc, item, i) => {
      if (i === 0) return acc;
      const prev = ordered[i - 1];
      if (!prev.end) return acc;
      const gap = new Date(item.start).getTime() - new Date(prev.end).getTime();
      return gap > 0 ? [...acc, gap] : acc;
    }, []);
    const totalAwakeMs = gaps.reduce((s, g) => s + g, 0);
    const avgAwakeMs = gaps.length > 0 ? Math.round(totalAwakeMs / gaps.length) : 0;
    const avgMs = agg.activeDays > 0 ? Math.round(agg.totalMs / agg.activeDays) : 0;
    return { count: agg.count, totalMs: agg.totalMs, avgMs, totalAwakeMs, avgAwakeMs };
  },

  findLatest: (ctx: TBabyContext): TSleep | null =>
    sleepRepository.findLatest(ctx.babyId),

  findById: (id: number, ctx: TBabyContext): TSleep | null =>
    sleepRepository.findById(id, ctx.babyId),

  insert: (data: TPostSleep, ctx: TBabyContext): TSleep =>
    sleepRepository.insert(data, ctx.babyId, ctx.userId),

  update: (id: number, data: Partial<TPostSleep>, ctx: TBabyContext): TSleep | null =>
    sleepRepository.update(id, data, ctx.babyId),

  delete: (id: number, ctx: TBabyContext): boolean =>
    sleepRepository.delete(id, ctx.babyId),

  getBackup: (from: string, to: string, ctx: TBabyContext): TSleep[] =>
    sleepRepository.getBackup(from, to, ctx.babyId),
};
