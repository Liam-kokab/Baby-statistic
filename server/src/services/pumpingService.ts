import type { TPumping, TPumpingSummary } from 'baby-statistic-common';
import { pumpingRepository } from '../repositories/pumpingRepository';
import type { TTimeFilter } from '../types';

export const pumpingService = {
  findAll: (filter: TTimeFilter = {}): TPumping[] =>
    pumpingRepository.findAll(filter),

  findSummary: (filter: TTimeFilter = {}): TPumpingSummary =>
    pumpingRepository.findSummary(filter),

  findLatest: (): TPumping | null =>
    pumpingRepository.findLatest(),

  findById: (id: number): TPumping | null =>
    pumpingRepository.findById(id),

  insert: (): TPumping =>
    pumpingRepository.insert(),

  update: (id: number, data: { createdAt?: string }): TPumping | null =>
    pumpingRepository.update(id, data),

  delete: (id: number): boolean =>
    pumpingRepository.delete(id),
};

