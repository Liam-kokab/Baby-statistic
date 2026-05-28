import type { TDrankMilk, TPostDrankMilk, TServedMilkStatus } from 'baby-statistic-common';
import { drankMilkRepository } from '../repositories/drankMilkRepository';
import { servedMilkRepository } from '../repositories/servedMilkRepository';
import type { TTimeFilter } from '../types';
import { getSuggestedNextDrinkDetails, getSuggestedNextDrinkAmount } from './drankMilkPrediction';
import { predictionService } from './predictionService';
import { predictionRepository } from '../repositories/predictionRepository';

export const drankMilkService = {
  findAll: (filter: TTimeFilter = {}): TDrankMilk[] =>
    drankMilkRepository.findAll(filter),

  findLatest: (): TDrankMilk | null =>
    drankMilkRepository.findLatest(),

  findById: (id: number): TDrankMilk | null =>
    drankMilkRepository.findById(id),

  insert: (data: TPostDrankMilk): TDrankMilk => {
    // If this is a new bottle, and it's from stored milk (FRIDGE/FREEZER), record the current prediction,
    // then insert the drank record and link the prediction. Skip prediction logging/linking for BOOB.
    let predRecId: number | null = null;
    if (data.isNewBottle && data.source !== 'BOOB') {
      // Only treat FRIDGE/FREEZER as "stored milk" for prediction logging/linking and stock deduction.
      const isStored = data.source === 'FRIDGE' || data.source === 'FREEZER';

      if (isStored) {
        try {
          const details = getSuggestedNextDrinkDetails();
          const predRec = predictionRepository.insert(details.suggested, {
            rawPrediction: details.raw,
            observedMax: details.observedMax,
            recencyFactor: details.recencyFactor,
            roundingStep: details.roundingStep,
          });

          predRecId = predRec.id;
        } catch (e) {
          // Do not fail the insert if prediction logging fails
          console.error('Failed to log prediction:', e);
        }
        servedMilkRepository.deductStock(data.source as TServedMilkStatus, data.amount);
      }
    }

    if (data.source !== 'BOOB') {
      servedMilkRepository.deductStock(data.source, data.amount);
    }
    if (!data.isNewBottle) {
      const latest = drankMilkRepository.findLatest();
      if (latest) {
        return drankMilkRepository.update(latest.id, { amount: latest.amount + data.amount }) ?? drankMilkRepository.insert(data);
      }
    }
    const insertedDate = drankMilkRepository.insert(data);

    // Link prediction to actual drank record only for FRIDGE/FREEZER (stored milk).
    if (predRecId) {
      try {
        predictionService.linkActual(predRecId, insertedDate.id);
      } catch (e) {
        console.error('Failed to link prediction to actual drank record:', e);
      }
    }

    return insertedDate;
  },

  update: (id: number, data: Partial<TPostDrankMilk> & { createdAt?: string }): TDrankMilk | null =>
    drankMilkRepository.update(id, data),

  delete: (id: number): boolean =>
    drankMilkRepository.delete(id),

  deductWaste: (waste: number): TDrankMilk | null =>
    drankMilkRepository.deductWaste(waste),

  suggestNextDrinkAmount: (options?: {
    lookbackDays?: number;
    weeks?: number;
    roundingStep?: number;
    maxReduction?: number;
    halfLifeWeeks?: number;
  }): number => getSuggestedNextDrinkAmount(options),

  getBackup: (from: string, to: string): TDrankMilk[] =>
    drankMilkRepository.getBackup(from, to),
};
