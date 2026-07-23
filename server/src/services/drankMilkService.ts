import type { TDrankMilk, TPostDrankMilk, TDrankMilkSummary } from 'baby-statistic-common';
import { drankMilkRepository } from '../repositories/drankMilkRepository';
import { servedMilkRepository } from '../repositories/servedMilkRepository';
import type { TTimeFilter, TBabyContext } from '../types';
import getSuggestedNextDrinkDetails, { getSuggestedNextDrinkAmount } from './drankMilkPrediction';
import { predictionService } from './predictionService';
import { predictionRepository } from '../repositories/predictionRepository';

export const drankMilkService = {
  findAll: (filter: TTimeFilter = {}, ctx: TBabyContext): TDrankMilk[] =>
    drankMilkRepository.findAll(filter, ctx.babyId),

  findSummary: (filter: TTimeFilter = {}, ctx: TBabyContext): TDrankMilkSummary =>
    drankMilkRepository.findSummary(filter, ctx.babyId),

  findLatest: (ctx: TBabyContext): TDrankMilk | null =>
    drankMilkRepository.findLatest(ctx.babyId),

  findById: (id: number, ctx: TBabyContext): TDrankMilk | null =>
    drankMilkRepository.findById(id, ctx.babyId),

  insert: (data: TPostDrankMilk, ctx: TBabyContext): TDrankMilk => {
    let predRecId: number | null = null;
    const isStored = data.source === 'FRIDGE' || data.source === 'FREEZER';

    if (data.isNewBottle && isStored) {
      try {
        const details = getSuggestedNextDrinkDetails(ctx.babyId);
        const predRec = predictionRepository.insert(details.suggestion, {
          rawPrediction: details.raw,
          suggestBasedOnTwoHour: details.suggestBasedOnTwoHour,
          suggestBasedOnFourHour: details.suggestBasedOnFourHour,
          suggestBasedOnSixHour: details.suggestBasedOnSixHour,
        }, ctx.babyId);
        predRecId = predRec.id;
      } catch (e) {
        console.error('Failed to log prediction:', e);
      }
    }

    // Deduct from stock exactly once per non-BOOB drink, regardless of isNewBottle
    // (topping up an existing record still consumes stock).
    if (data.source !== 'BOOB') {
      servedMilkRepository.deductStock(data.source, data.amount, ctx.babyId);
    }

    if (!data.isNewBottle) {
      const latest = drankMilkRepository.findLatest(ctx.babyId);
      if (latest) {
        return drankMilkRepository.update(latest.id, { amount: latest.amount + data.amount }, ctx.babyId) ?? drankMilkRepository.insert(data, ctx.babyId, ctx.userId);
      }
    }
    const insertedDate = drankMilkRepository.insert(data, ctx.babyId, ctx.userId);

    if (predRecId) {
      try {
        predictionService.linkActual(predRecId, insertedDate.id);
      } catch (e) {
        console.error('Failed to link prediction to actual drank record:', e);
      }
    }

    return insertedDate;
  },

  update: (id: number, data: Partial<TPostDrankMilk> & { createdAt?: string }, ctx: TBabyContext): TDrankMilk | null =>
    drankMilkRepository.update(id, data, ctx.babyId),

  delete: (id: number, ctx: TBabyContext): boolean =>
    drankMilkRepository.delete(id, ctx.babyId),

  deductWaste: (waste: number, ctx: TBabyContext): TDrankMilk | null =>
    drankMilkRepository.deductWaste(waste, ctx.babyId),

  suggestNextDrinkAmount: (ctx: TBabyContext): number => getSuggestedNextDrinkAmount(ctx.babyId),

  getBackup: (from: string, to: string, ctx: TBabyContext): TDrankMilk[] =>
    drankMilkRepository.getBackup(from, to, ctx.babyId),
};
