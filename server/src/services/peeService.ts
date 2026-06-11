import type { TPee } from 'baby-statistic-common';
import { peeRepository } from '../repositories/peeRepository';
import type { TTimeFilter } from '../types';

export const peeService = {
  findAll: (filter: TTimeFilter = {}): TPee[] =>
    peeRepository.findAll(filter),


  // ...existing code...
  findById: (id: number): TPee | null =>
    peeRepository.findById(id),

  insert: (): TPee =>
    peeRepository.insert(),

  update: (id: number, data: { createdAt?: string } = {}): TPee | null =>
    peeRepository.update(id, data),

  delete: (id: number): boolean =>
    peeRepository.delete(id),

  getBackup: (from: string, to: string): TPee[] =>
    peeRepository.getBackup(from, to),
};
