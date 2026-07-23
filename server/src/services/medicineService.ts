import type { TMedicine, TMedicineLog, TMedicineWithLatestLog, TPostMedicine } from 'baby-statistic-common';
import { medicineRepository } from '../repositories/medicineRepository';
import { nowOslo } from '../utils/time';
import type { TTimeFilter, TBabyContext } from '../types';

export const medicineService = {
  findAllActive: (ctx: TBabyContext): TMedicineWithLatestLog[] =>
    medicineRepository.findAllActive(ctx.babyId),

  findAll: (ctx: TBabyContext): TMedicine[] =>
    medicineRepository.findAll(ctx.babyId),

  setActive: (id: number, isActive: boolean, ctx: TBabyContext): TMedicine | null =>
    medicineRepository.setActive(id, isActive, ctx.babyId),

  insert: (data: TPostMedicine, ctx: TBabyContext): TMedicine =>
    medicineRepository.insert(data, ctx.babyId, ctx.userId),

  softDelete: (id: number, ctx: TBabyContext): boolean =>
    medicineRepository.softDelete(id, ctx.babyId),

  findById: (id: number, ctx: TBabyContext): TMedicine | null =>
    medicineRepository.findById(id, ctx.babyId),

  update: (id: number, data: TPostMedicine, ctx: TBabyContext): TMedicine | null =>
    medicineRepository.update(id, data, ctx.babyId),

  logTaken: (medicineId: number, ctx: TBabyContext, takenAt?: string): TMedicineLog =>
    medicineRepository.insertLog(medicineId, takenAt ?? nowOslo(), ctx.babyId, ctx.userId),

  findLogs: (filter: TTimeFilter = {}, ctx: TBabyContext): TMedicineLog[] =>
    medicineRepository.findLogs(filter, ctx.babyId),

  findLogById: (id: number, ctx: TBabyContext): TMedicineLog | null =>
    medicineRepository.findLogById(id, ctx.babyId),

  updateLog: (id: number, takenAt: string, ctx: TBabyContext): TMedicineLog | null =>
    medicineRepository.updateLog(id, takenAt, ctx.babyId),

  deleteLog: (id: number, ctx: TBabyContext): boolean =>
    medicineRepository.deleteLog(id, ctx.babyId),
};
