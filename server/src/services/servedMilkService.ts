import type {
  TServedMilk,
  TPostServedMilk,
  TServedMilkTotal,
} from 'baby-statistic-common';
import { servedMilkRepository } from '../repositories/servedMilkRepository';
import type { TTimeFilter, TBabyContext } from '../types';
import { nowOslo } from '../utils/time';

const calcExpiryDate = (status: 'FRIDGE' | 'FREEZER'): string => {
  const now = new Date(`${nowOslo()}Z`);
  if (status === 'FRIDGE') {
    now.setUTCDate(now.getUTCDate() + 4);
  } else {
    now.setUTCMonth(now.getUTCMonth() + 6);
  }
  const y  = now.getUTCFullYear();
  const mo = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d  = String(now.getUTCDate()).padStart(2, '0');
  const h  = String(now.getUTCHours()).padStart(2, '0');
  const mi = String(now.getUTCMinutes()).padStart(2, '0');
  const s  = String(now.getUTCSeconds()).padStart(2, '0');
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
};

export const servedMilkService = {
  findAll: (filter: TTimeFilter = {}, ctx: TBabyContext): TServedMilk[] =>
    servedMilkRepository.findAll(filter, ctx.babyId),

  findById: (id: number, ctx: TBabyContext): TServedMilk | null =>
    servedMilkRepository.findById(id, ctx.babyId),

  insert: (data: TPostServedMilk, ctx: TBabyContext): TServedMilk => {
    const record = servedMilkRepository.insert(
      { ...data, expiryDate: calcExpiryDate(data.status as 'FRIDGE' | 'FREEZER') },
      ctx.babyId, ctx.userId
    );
    servedMilkRepository.expireOverdue(ctx.babyId);
    return record;
  },

  update: (id: number, data: Partial<TPostServedMilk> & { createdAt?: string }, ctx: TBabyContext): TServedMilk | null => {
    const record = servedMilkRepository.update(id, data, ctx.babyId);
    servedMilkRepository.expireOverdue(ctx.babyId);
    return record;
  },

  delete: (id: number, ctx: TBabyContext): boolean =>
    servedMilkRepository.delete(id, ctx.babyId),

  getTotal: (ctx: TBabyContext): TServedMilkTotal =>
    servedMilkRepository.getTotal(ctx.babyId),

  getBackup: (from: string, to: string, ctx: TBabyContext): TServedMilk[] =>
    servedMilkRepository.getBackup(from, to, ctx.babyId),
};
