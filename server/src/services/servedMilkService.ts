import type { TServedMilk, TPostServedMilk, TServedMilkTotal, TServedMilkStatus } from 'baby-statistic-common';
import { servedMilkRepository } from '../repositories/servedMilkRepository';
import type { TTimeFilter } from '../types';
import { nowOslo } from '../utils/time';

const calcExpiryDate = (status: TServedMilkStatus): string => {
  const now = new Date(`${nowOslo()}Z`);
  if (status === 'FRIDGE') {
    now.setUTCDate(now.getUTCDate() + 4);
  } else {
    now.setUTCMonth(now.getUTCMonth() + 6);
  }
  const y = now.getUTCFullYear();
  const mo = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const h = String(now.getUTCHours()).padStart(2, '0');
  const mi = String(now.getUTCMinutes()).padStart(2, '0');
  const s = String(now.getUTCSeconds()).padStart(2, '0');
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
};

export const servedMilkService = {
  findAll: (filter: TTimeFilter = {}): TServedMilk[] =>
    servedMilkRepository.findAll(filter),

  findById: (id: number): TServedMilk | null =>
    servedMilkRepository.findById(id),

  insert: (data: TPostServedMilk): TServedMilk => {
    const record = servedMilkRepository.insert({ ...data, expiryDate: calcExpiryDate(data.status) });
    servedMilkRepository.expireOverdue();
    return record;
  },

  update: (id: number, data: Partial<TPostServedMilk> & { createdAt?: string }): TServedMilk | null => {
    const record = servedMilkRepository.update(id, data);
    servedMilkRepository.expireOverdue();
    return record;
  },

  delete: (id: number): boolean =>
    servedMilkRepository.delete(id),

  getTotal: (): TServedMilkTotal =>
    servedMilkRepository.getTotal(),

  getBackup: (from: string, to: string): TServedMilk[] =>
    servedMilkRepository.getBackup(from, to),
};
