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
  actualId: number | null;
  actualAmount: number | null;
  createdAt: string | null;
  rawPrediction?: number | null;
  suggestBasedOnTwoHour?: number | null;
  suggestBasedOnFourHour?: number | null;
  suggestBasedOnSixHour?: number | null;
};

// Expect query to return prediction_log.* plus drank_milk columns via LEFT JOIN
type TPredictionRow = TPredictionDb & { drank_created_at: string | null; drank_amount: number | null };

const fromDb = (row: TPredictionRow): TPrediction => ({
  id: row.id,
  predictedAmount: row.predicted_amount,
  actualId: row.actual_id ?? null,
  actualAmount: row.drank_amount ?? null,
  // Use the drank_milk timestamp as the canonical createdAt for the prediction (null if not yet linked)
  createdAt: row.drank_created_at ? toOsloIso(row.drank_created_at) : null,
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
    // LEFT JOIN so unlinked predictions (actual_id IS NULL) are also included.
    // Filter by drank_milk.created_at when provided; unlinked rows pass through with null timestamp.
    const conditions: string[] = [];
    const params: string[] = [];
    if (filter.from) {
      conditions.push('(d.created_at >= ? OR p.actual_id IS NULL)');
      params.push(filter.from);
    }
    if (filter.to) {
      conditions.push('(d.created_at <= ? OR p.actual_id IS NULL)');
      params.push(filter.to);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT p.*, d.created_at AS drank_created_at, d.amount AS drank_amount FROM prediction_log p LEFT JOIN drank_milk d ON p.actual_id = d.id ${where} ORDER BY COALESCE(d.created_at, '0') DESC`;
    const rows = db.prepare<string[], TPredictionRow>(sql).all(...params);
    return rows.map(fromDb);
  },

  findLatest: (): TPrediction | null => {
    const row = db.prepare<[], TPredictionRow>(
      `SELECT p.*, d.created_at AS drank_created_at, d.amount AS drank_amount FROM prediction_log p LEFT JOIN drank_milk d ON p.actual_id = d.id ORDER BY p.id DESC LIMIT 1`
    ).get();
    return row ? fromDb(row) : null;
  },
};

