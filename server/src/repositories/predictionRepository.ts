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
  baby_id: number;
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

type TPredictionRow = TPredictionDb & { drank_created_at: string | null; drank_amount: number | null };

const fromDb = (row: TPredictionRow): TPrediction => ({
  id: row.id,
  predictedAmount: row.predicted_amount,
  actualId: row.actual_id ?? null,
  actualAmount: row.drank_amount ?? null,
  createdAt: row.drank_created_at ? toOsloIso(row.drank_created_at) : null,
  rawPrediction: row.raw_prediction ?? null,
  suggestBasedOnTwoHour: row.suggestBasedOnTwoHour ?? null,
  suggestBasedOnFourHour: row.suggestBasedOnFourHour ?? null,
  suggestBasedOnSixHour: row.suggestBasedOnSixHour ?? null,
});

export const predictionRepository = {
  insert: (
    predictedAmount: number,
    debug: { rawPrediction?: number | null; suggestBasedOnTwoHour?: number | null; suggestBasedOnFourHour?: number | null; suggestBasedOnSixHour?: number | null } = {},
    babyId: number
  ): { id: number; predictedAmount: number } => {
    const result = db.prepare(
      'INSERT INTO prediction_log (predicted_amount, raw_prediction, suggestBasedOnTwoHour, suggestBasedOnFourHour, suggestBasedOnSixHour, baby_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      predictedAmount,
      debug.rawPrediction ?? null,
      debug.suggestBasedOnTwoHour ?? null,
      debug.suggestBasedOnFourHour ?? null,
      debug.suggestBasedOnSixHour ?? null,
      babyId,
    );
    return { id: Number(result.lastInsertRowid), predictedAmount };
  },

  updateActualId: (predictionId: number, actualId: number): void => {
    db.prepare('UPDATE prediction_log SET actual_id = @actual WHERE id = @id').run({ actual: actualId, id: predictionId });
  },

  findAll: (filter: TTimeFilter = {}, babyId: number): TPrediction[] => {
    const conditions: string[] = ['p.baby_id = ?'];
    const params: unknown[] = [babyId];
    if (filter.from) {
      conditions.push('(d.created_at >= ? OR p.actual_id IS NULL)');
      params.push(filter.from);
    }
    if (filter.to) {
      conditions.push('(d.created_at <= ? OR p.actual_id IS NULL)');
      params.push(filter.to);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const sql = `SELECT p.*, d.created_at AS drank_created_at, d.amount AS drank_amount FROM prediction_log p LEFT JOIN drank_milk d ON p.actual_id = d.id ${where} ORDER BY COALESCE(d.created_at, '0') DESC`;
    const rows = db.prepare<unknown[], TPredictionRow>(sql).all(...params);
    return rows.map(fromDb);
  },

  findLatest: (babyId: number): TPrediction | null => {
    const row = db.prepare<[number], TPredictionRow>(
      `SELECT p.*, d.created_at AS drank_created_at, d.amount AS drank_amount FROM prediction_log p LEFT JOIN drank_milk d ON p.actual_id = d.id WHERE p.baby_id = ? ORDER BY p.id DESC LIMIT 1`
    ).get(babyId);
    return row ? fromDb(row) : null;
  },
};
