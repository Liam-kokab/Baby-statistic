import type { TDrankMilk, TPostDrankMilk } from 'baby-statistic-common';
import { drankMilkRepository } from '../repositories/drankMilkRepository';
import { servedMilkRepository } from '../repositories/servedMilkRepository';
import type { TTimeFilter } from '../types';
import { toOsloLocal } from '../utils/time';

export const drankMilkService = {
  findAll: (filter: TTimeFilter = {}): TDrankMilk[] =>
    drankMilkRepository.findAll(filter),

  findLatest: (): TDrankMilk | null =>
    drankMilkRepository.findLatest(),

  findById: (id: number): TDrankMilk | null =>
    drankMilkRepository.findById(id),

  insert: (data: TPostDrankMilk): TDrankMilk => {
    if (data.source !== 'BOOB') {
      servedMilkRepository.deductStock(data.source, data.amount);
    }
    if (data.isNewBottle != null) {
      const twoHoursAgo = toOsloLocal(new Date(Date.now() - 150 * 60 * 1000).toISOString()); // 150 min — must match prevBottleEnabled threshold in HomePage
      const recent = drankMilkRepository.findRecentBySource(data.source, twoHoursAgo);
      if (recent) {
        return drankMilkRepository.update(recent.id, { amount: recent.amount + data.amount }) ?? drankMilkRepository.insert(data);
      }
    }
    return drankMilkRepository.insert(data);
  },

  update: (id: number, data: Partial<TPostDrankMilk> & { createdAt?: string }): TDrankMilk | null =>
    drankMilkRepository.update(id, data),

  delete: (id: number): boolean =>
    drankMilkRepository.delete(id),

  deductWaste: (waste: number): TDrankMilk | null =>
    drankMilkRepository.deductWaste(waste),

  getBackup: (from: string, to: string): TDrankMilk[] =>
    drankMilkRepository.getBackup(from, to),
};
