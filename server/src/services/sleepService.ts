import type { TSleep, TPostSleep, TSleepSummary } from 'baby-statistic-common';
import { sleepRepository } from '../repositories/sleepRepository';
import type { TTimeFilter } from '../types';

export const sleepService = {
  findAll: (filter: TTimeFilter = {}): TSleep[] =>
    sleepRepository.findAll(filter),

  findSummary: (filter: TTimeFilter = {}): TSleepSummary => {
    const agg = sleepRepository.findSummaryAgg(filter);
    const ordered = sleepRepository.findOrderedForRange(filter);
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

  findLatest: (): TSleep | null =>
    sleepRepository.findLatest(),
  // ...existing code...

  findById: (id: number): TSleep | null =>
    sleepRepository.findById(id),

  insert: (data: TPostSleep): TSleep =>
    sleepRepository.insert(data),

  update: (id: number, data: Partial<TPostSleep>): TSleep | null =>
    sleepRepository.update(id, data),

  delete: (id: number): boolean =>
    sleepRepository.delete(id),

  getBackup: (from: string, to: string): TSleep[] =>
    sleepRepository.getBackup(from, to),
};
