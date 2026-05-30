import assert from 'assert';
import { describe, it } from 'vitest';
import { getAverageWithWeight, divideDataByHours, reduceSuggestionToAvoidWaste } from './drankMilkPrediction';
import type { TDrankMilk } from 'baby-statistic-common';

const approxEqual = (a: number | null, b: number | null, eps = 1e-9): boolean => {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) <= eps;
};

describe('drankMilkPrediction', () => {
  describe('getAverageWithWeight', () => {
    it('should return null for empty input', () => {
      const got = getAverageWithWeight([]);
      assert.strictEqual(got, null);
    });

    it('should return the value for a single item with weight 1', () => {
      const got = getAverageWithWeight([{value: 42, weight: 1}]);
      assert.strictEqual(got, 42);
    });

    it('should average two values with equal weights', () => {
      const got = getAverageWithWeight([{value: 10, weight: 1}, {value: 20, weight: 1}]);
      assert.strictEqual(got, 15);
    });

    it('should reduce effect when weight is less than 1', () => {
      const got = getAverageWithWeight([{value: 100, weight: 0.5}, {value: 0, weight: 1}]);
      const expected = (100 * 0.5) / (0.5 + 1);
      assert.ok(approxEqual(got, expected), `expected ${expected} got ${got}`);
    });

    it('should compute correct weighted average for simple example', () => {
      const got = getAverageWithWeight([{value: 3, weight: 2}, {value: 6, weight: 1}]);
      const expected = (3 * 2 + 6) / (2 + 1);
      assert.strictEqual(got, expected);
    });

    it('should increase effect when weight is greater than 1', () => {
      const got = getAverageWithWeight([{value: 100, weight: 2}, {value: 0, weight: 1}]);
      const expected = (100 * 2) / (2 + 1);
      assert.ok(approxEqual(got, expected), `expected ${expected} got ${got}`);
    });

    it('should ignore zero-weight entries when other positive weights exist', () => {
      const got = getAverageWithWeight([{value: 100, weight: 0}, {value: 50, weight: 1}]);
      assert.strictEqual(got, 50);
    });

    it('should return null when all weights are zero', () => {
      const got = getAverageWithWeight([{value: 10, weight: 0}, {value: 20, weight: 0}]);
      assert.strictEqual(got, null);
    });

    it('should filter invalid entries like NaN and use remaining valid entries', () => {
      const got = getAverageWithWeight([{value: NaN, weight: 1}, {value: 30, weight: 1}]);
      assert.strictEqual(got, 30);
    });
  });

  describe('reduceSuggestionToAvoidWaste', () => {
    const makeRecord = (ts: number, id = 1, amount = 200): TDrankMilk => ({
      id,
      amount,
      source: 'FRIDGE',
      createdAt: new Date(ts).toISOString(),
    });

    it('reduces suggestion by 33% when latest equals max (five items of 200, raw=200)', () => {
      const base = Date.now();
      const records: TDrankMilk[] = [
        makeRecord(base - 4000, 1),
        makeRecord(base - 3000, 2),
        makeRecord(base - 2000, 3),
        makeRecord(base - 1000, 4),
        makeRecord(base, 5),
      ];

      const raw = 200;
      const got = reduceSuggestionToAvoidWaste(records, raw);
      // raw 200 reduced by 33% -> 200 * 0.67 = 134 -> rounded 134
      assert.strictEqual(got, 134);
    });

    it('reduces suggestion very little when latest is much smaller than max', () => {
      const base = Date.now();
      const records: TDrankMilk[] = [
        makeRecord(base - 5000, 1),
        makeRecord(base - 4000, 2),
        makeRecord(base - 3000, 3),
        makeRecord(base - 2000, 4),
        makeRecord(base - 1000, 5),
      ];

      const raw = 10;
      const got = reduceSuggestionToAvoidWaste(records, raw);
      // latest is 200, max is 200, raw is 10 -> no reduction since raw is already small
      assert.strictEqual(got, 10);
    });
  });


  describe('divideDataByHours', () => {
    const makeRecord = (ts: number, id = 1, amount = 50): TDrankMilk => ({
      id,
      amount,
      source: 'FRIDGE',
      createdAt: new Date(ts).toISOString(),
    });

    it('returns empty array for empty input', () => {
      const out = divideDataByHours([], 2);
      assert.deepStrictEqual(out, []);
    });

    it('defaults invalid hours to 1 hour when hours <= 0', () => {
      const base = Date.now();
      const a = makeRecord(base, 1);
      const b = makeRecord(base + 30 * 60 * 1000, 2); // +30 minutes

      const out = divideDataByHours([a, b], 0);
      assert.strictEqual(out.length, 1);
      assert.strictEqual(out[0].length, 2);
    });

    it('places all records in one bucket when hours is very large', () => {
      const base = Date.now();
      const a = makeRecord(base, 1);
      const b = makeRecord(base + 48 * 60 * 60 * 1000, 2); // +48 hours

      const out = divideDataByHours([a, b], 1000);
      assert.strictEqual(out.length, 1);
      assert.strictEqual(out[0].length, 2);
    });

    it('creates multiple buckets and preserves empty buckets for gaps', () => {
      const base = Date.UTC(2026, 0, 1, 0, 0, 0);
      const r0 = makeRecord(base, 1);
      const r1 = makeRecord(base + 2 * 60 * 60 * 1000, 2); // +2h -> idx 1 for hours=2
      const r2 = makeRecord(base + 6 * 60 * 60 * 1000, 3); // +6h -> idx 3 for hours=2

      const out = divideDataByHours([r0, r1, r2], 2);
      assert.strictEqual(out.length, 4);
      assert.deepStrictEqual(out[0], [r0]);
      assert.deepStrictEqual(out[1], [r1]);
      assert.deepStrictEqual(out[2], []);
      assert.deepStrictEqual(out[3], [r2]);
    });

    it('places invalid date records into the first bucket', () => {
      const base = Date.now();
      const bad: any = { id: 1, amount: 30, source: 'FRIDGE', createdAt: 'not-a-date' };
      const good = makeRecord(base + 3 * 60 * 60 * 1000, 2); // +3h

      const out = divideDataByHours([bad as TDrankMilk, good], 2);
      // bad should be placed in first bucket
      assert.ok(out.length >= 2);
      assert.ok(out[0].some((x: any) => x.createdAt === bad.createdAt));
      const flattened = out.flat();
      assert.ok(flattened.some((x) => x.createdAt === good.createdAt));
    });
  });
});

