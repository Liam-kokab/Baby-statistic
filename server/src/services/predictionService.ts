import { predictionRepository, TPrediction } from '../repositories/predictionRepository';
import type { TTimeFilter } from '../types';


export const predictionService = {
  insert: (
    predictedAmount: number,
    debug: { rawPrediction?: number | null; observedMax?: number | null; recencyFactor?: number | null; roundingStep?: number | null } = {}
  ): { id: number; predictedAmount: number } =>
    predictionRepository.insert(predictedAmount, debug),

  findAll: (filter: TTimeFilter = {}): TPrediction[] =>
    predictionRepository.findAll(filter),

  findLatest: (): TPrediction | null =>
    predictionRepository.findLatest(),

  linkActual: (predictionId: number, actualId: number): void =>
    predictionRepository.updateActualId(predictionId, actualId),
};

export default predictionService;

