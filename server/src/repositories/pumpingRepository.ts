import type { TPumping, TPumpingDb, TPumpingSummary } from 'baby-statistic-common';
import { db } from '../db';
import type { TTimeFilter } from '../types';
import { createSimpleEventRepository } from './simpleEventRepositoryFactory';

const base = createSimpleEventRepository<TPumpingDb, TPumping>('pumping');

export const pumpingRepository = {
  ...base,

  findSummary: (filter: TTimeFilter, babyId: number): TPumpingSummary => {
    const conditions = ['baby_id = ?', ...(filter.from ? ['created_at >= ?'] : []), ...(filter.to ? ['created_at <= ?'] : [])];
    const params = [babyId, ...(filter.from ? [filter.from] : []), ...(filter.to ? [filter.to] : [])];
    const row = db.prepare<unknown[], { count: number; activeDays: number }>(
      `SELECT COUNT(*) AS count, COUNT(DISTINCT date(created_at)) AS activeDays FROM pumping WHERE ${conditions.join(' AND ')}`
    ).get(...params)!;
    return { count: row.count, avgPerDay: row.activeDays > 0 ? Math.round((row.count / row.activeDays) * 10) / 10 : 0 };
  },
};
