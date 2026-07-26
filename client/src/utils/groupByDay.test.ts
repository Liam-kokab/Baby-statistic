import { describe, expect, it } from 'vitest';
import { groupByDay } from './groupByDay';

type TItem = { createdAt: string };

describe('groupByDay', () => {
  it('groups items by their date (YYYY-MM-DD) prefix', () => {
    const items: TItem[] = [
      { createdAt: '2026-07-26T08:00:00+02:00' },
      { createdAt: '2026-07-26T20:00:00+02:00' },
      { createdAt: '2026-07-25T10:00:00+02:00' },
    ];

    const result = groupByDay(items);

    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2026-07-26');
    expect(result[0].items).toHaveLength(2);
    expect(result[1].date).toBe('2026-07-25');
    expect(result[1].items).toHaveLength(1);
  });

  it('sorts groups descending by date', () => {
    const items: TItem[] = [
      { createdAt: '2026-01-01T00:00:00+01:00' },
      { createdAt: '2026-03-01T00:00:00+01:00' },
      { createdAt: '2026-02-01T00:00:00+01:00' },
    ];

    const result = groupByDay(items);

    expect(result.map((g) => g.date)).toEqual(['2026-03-01', '2026-02-01', '2026-01-01']);
  });

  it('returns an empty array for an empty input', () => {
    expect(groupByDay([])).toEqual([]);
  });

  it('supports a custom key function', () => {
    type TCustomItem = { createdAt: string; at: string };
    const items: TCustomItem[] = [
      { createdAt: '', at: '2026-05-01T00:00:00Z' },
      { createdAt: '', at: '2026-05-02T00:00:00Z' },
    ];

    const result = groupByDay(items, (item) => item.at);

    expect(result.map((g) => g.date)).toEqual(['2026-05-02', '2026-05-01']);
  });
});


