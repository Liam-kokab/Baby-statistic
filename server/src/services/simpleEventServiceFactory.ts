import type { TTimeFilter, TBabyContext } from '../types';
import type { TSimpleEvent, TSimpleEventRepository } from '../repositories/simpleEventRepositoryFactory';

export type TSimpleEventService<T extends TSimpleEvent> = {
  findAll: (filter: TTimeFilter, ctx: TBabyContext) => T[];
  findById: (id: number, ctx: TBabyContext) => T | null;
  insert: (ctx: TBabyContext) => T;
  update: (id: number, data: { createdAt?: string }, ctx: TBabyContext) => T | null;
  delete: (id: number, ctx: TBabyContext) => boolean;
  getBackup: (from: string, to: string, ctx: TBabyContext) => T[];
};

/** Builds a service that delegates to a {@link TSimpleEventRepository}, scoping every call by `ctx`. */
export const createSimpleEventService = <T extends TSimpleEvent>(
  repository: TSimpleEventRepository<T>,
): TSimpleEventService<T> => ({
  findAll: (filter: TTimeFilter = {}, ctx: TBabyContext): T[] => repository.findAll(filter, ctx.babyId),
  findById: (id: number, ctx: TBabyContext): T | null => repository.findById(id, ctx.babyId),
  insert: (ctx: TBabyContext): T => repository.insert(ctx.babyId, ctx.userId),
  update: (id: number, data: { createdAt?: string }, ctx: TBabyContext): T | null => repository.update(id, data, ctx.babyId),
  delete: (id: number, ctx: TBabyContext): boolean => repository.delete(id, ctx.babyId),
  getBackup: (from: string, to: string, ctx: TBabyContext): T[] => repository.getBackup(from, to, ctx.babyId),
});

