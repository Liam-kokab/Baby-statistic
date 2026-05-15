import type { TSleep, TPostSleep } from 'baby-statistic-common';
import { sleepRepository } from '../repositories/sleepRepository';
import type { TTimeFilter } from '../types';

export const sleepService = {
  findAll: (filter: TTimeFilter = {}): TSleep[] =>
    sleepRepository.findAll(filter),

  findLatest: (): TSleep | null =>
    sleepRepository.findLatest(),

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
