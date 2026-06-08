import type { TMedicine, TMedicineLog, TMedicineWithLatestLog, TPostMedicine } from 'baby-statistic-common';
import { medicineRepository } from '../repositories/medicineRepository';
import { nowOslo } from '../utils/time';
import type { TTimeFilter } from '../types';

export const medicineService = {
  findAllActive: (): TMedicineWithLatestLog[] =>
    medicineRepository.findAllActive(),

  findAll: (): TMedicine[] =>
    medicineRepository.findAll(),

  setActive: (id: number, isActive: boolean): TMedicine | null =>
    medicineRepository.setActive(id, isActive),

  insert: (data: TPostMedicine): TMedicine =>
    medicineRepository.insert(data),

  softDelete: (id: number): boolean =>
    medicineRepository.softDelete(id),

  findById: (id: number): TMedicine | null =>
    medicineRepository.findById(id),

  update: (id: number, data: TPostMedicine): TMedicine | null =>
    medicineRepository.update(id, data),

  logTaken: (medicineId: number, takenAt?: string): TMedicineLog =>
    medicineRepository.insertLog(medicineId, takenAt ?? nowOslo()),

  findLogs: (filter: TTimeFilter = {}): TMedicineLog[] =>
    medicineRepository.findLogs(filter),

  findLogById: (id: number): TMedicineLog | null =>
    medicineRepository.findLogById(id),

  updateLog: (id: number, takenAt: string): TMedicineLog | null =>
    medicineRepository.updateLog(id, takenAt),

  deleteLog: (id: number): boolean =>
    medicineRepository.deleteLog(id),
};

