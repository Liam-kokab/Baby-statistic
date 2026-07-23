import { predictionRepository, TPrediction } from '../repositories/predictionRepository';
import type { TTimeFilter, TBabyContext } from '../types';


export const predictionService = {
  insert: (
    predictedAmount: number,
    debug: { rawPrediction?: number | null; suggestBasedOnTwoHour?: number | null; suggestBasedOnFourHour?: number | null; suggestBasedOnSixHour?: number | null } = {},
    ctx: TBabyContext
  ): { id: number; predictedAmount: number } =>
    predictionRepository.insert(predictedAmount, debug, ctx.babyId),

  findAll: (filter: TTimeFilter = {}, ctx: TBabyContext): TPrediction[] =>
    predictionRepository.findAll(filter, ctx.babyId),

  findLatest: (ctx: TBabyContext): TPrediction | null =>
    predictionRepository.findLatest(ctx.babyId),

  linkActual: (predictionId: number, actualId: number): void =>
    predictionRepository.updateActualId(predictionId, actualId),
};

export default predictionService;
