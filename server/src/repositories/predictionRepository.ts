import { db } from '../db';
import { toOsloIso } from '../utils/time';
import type { TTimeFilter } from '../types';

type TPredictionDb = {
  id: number;
  predicted_amount: number;
  raw_prediction?: number | null;
  suggestBasedOnTwoHour?: number | null;
  suggestBasedOnFourHour?: number | null;
  suggestBasedOnSixHour?: number | null;
  actual_id?: number | null;
};

export type TPrediction = {
  id: number;
  predictedAmount: number;
  actualId: number;
  createdAt: string;
  rawPrediction?: number | null;
  suggestBasedOnTwoHour?: number | null;
  suggestBasedOnFourHour?: number | null;
  suggestBasedOnSixHour?: number | null;
};

// Expect query to return prediction_log.* plus drank_milk.created_at AS drank_created_at
type TPredictionRow = TPredictionDb & { drank_created_at: string };

const fromDb = (row: TPredictionRow): TPrediction => ({
  id: row.id,
  predictedAmount: row.predicted_amount,
  actualId: row.actual_id as number,
  // Use the drank_milk timestamp as the canonical createdAt for the prediction
  createdAt: toOsloIso(row.drank_created_at),
  rawPrediction: row.raw_prediction ?? null,
  suggestBasedOnTwoHour: row.suggestBasedOnTwoHour ?? null,
  suggestBasedOnFourHour: row.suggestBasedOnFourHour ?? null,
  suggestBasedOnSixHour: row.suggestBasedOnSixHour ?? null,
});

export const predictionRepository = {
  insert: (
    predictedAmount: number,
    debug: { rawPrediction?: number | null; suggestBasedOnTwoHour?: number | null; suggestBasedOnFourHour?: number | null; suggestBasedOnSixHour?: number | null } = {}
  ): { id: number; predictedAmount: number } => {
    const result = db.prepare(
      'INSERT INTO prediction_log (predicted_amount, raw_prediction, suggestBasedOnTwoHour, suggestBasedOnFourHour, suggestBasedOnSixHour) VALUES (?, ?, ?, ?, ?)'
    ).run(
      predictedAmount,
      debug.rawPrediction ?? null,
      debug.suggestBasedOnTwoHour ?? null,
      debug.suggestBasedOnFourHour ?? null,
      debug.suggestBasedOnSixHour ?? null,
    );
    return { id: Number(result.lastInsertRowid), predictedAmount };
  },

  updateActualId: (predictionId: number, actualId: number): void => {
    db.prepare('UPDATE prediction_log SET actual_id = @actual WHERE id = @id').run({ actual: actualId, id: predictionId });
  },

  findAll: (filter: TTimeFilter = {}): TPrediction[] => {
    // Only return predictions that have been linked to an actual drank_milk (actual_id IS NOT NULL).
    // Join to drank_milk to use the drank_milk.created_at as the canonical timestamp for filtering and output.
    const conditions: string[] = ['p.actual_id IS NOT NULL'];
    const params: string[] = [];
    if (filter.from) {
      conditions.push('d.created_at >= ?');
      params.push(filter.from);
    }
    if (filter.to) {
      conditions.push('d.created_at <= ?');
      params.push(filter.to);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT p.*, d.created_at AS drank_created_at FROM prediction_log p JOIN drank_milk d ON p.actual_id = d.id ${where} ORDER BY d.created_at DESC`;
    const rows = db.prepare<string[], TPredictionRow>(sql).all(...params);
    return rows.map(fromDb);
  },

  findLatest: (): TPrediction | null => {
    const row = db.prepare<[], TPredictionRow>(
      `SELECT p.*, d.created_at AS drank_created_at FROM prediction_log p JOIN drank_milk d ON p.actual_id = d.id WHERE p.actual_id IS NOT NULL ORDER BY d.created_at DESC LIMIT 1`
    ).get();
    return row ? fromDb(row) : null;
  },
};

