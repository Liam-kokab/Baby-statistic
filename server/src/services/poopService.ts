import type { TPoop } from 'baby-statistic-common';
import { poopRepository } from '../repositories/poopRepository';
import type { TTimeFilter } from '../types';

export const poopService = {
  findAll: (filter: TTimeFilter = {}): TPoop[] =>
    poopRepository.findAll(filter),

  findById: (id: number): TPoop | null =>
    poopRepository.findById(id),

  insert: (): TPoop =>
    poopRepository.insert(),

  update: (id: number, data: { createdAt?: string } = {}): TPoop | null =>
    poopRepository.update(id, data),

  delete: (id: number): boolean =>
    poopRepository.delete(id),

  getBackup: (from: string, to: string): TPoop[] =>
    poopRepository.getBackup(from, to),
};
