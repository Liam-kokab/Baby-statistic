import { describe, expect, it } from 'vitest';
import { hasEnoughForView } from './hasEnoughForView';

type TItem = { createdAt: string };
const getDate = (item: TItem): string => item.createdAt;

describe('hasEnoughForView', () => {
  it('checks raw item count for the "item" view', () => {
    const items: TItem[] = Array.from({ length: 9 }, (_, i) => ({ createdAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00` }));
    expect(hasEnoughForView(items, 'item', getDate, 10)).toBe(false);

    items.push({ createdAt: '2026-01-10T00:00:00' });
    expect(hasEnoughForView(items, 'item', getDate, 10)).toBe(true);
  });

  it('checks distinct-day count for the "day" view', () => {
    const items: TItem[] = [
      { createdAt: '2026-01-01T08:00:00' },
      { createdAt: '2026-01-01T20:00:00' },
      { createdAt: '2026-01-02T08:00:00' },
    ];
    expect(hasEnoughForView(items, 'day', getDate, 3)).toBe(false);
    expect(hasEnoughForView(items, 'day', getDate, 2)).toBe(true);
  });

  it('checks distinct-week (Mon-Sun) count for the "week" view', () => {
    const items: TItem[] = [
      { createdAt: '2026-01-05T00:00:00' }, // Monday
      { createdAt: '2026-01-08T00:00:00' }, // same week
      { createdAt: '2026-01-12T00:00:00' }, // next Monday
    ];
    expect(hasEnoughForView(items, 'week', getDate, 2)).toBe(true);
    expect(hasEnoughForView(items, 'week', getDate, 3)).toBe(false);
  });

  it('returns true when there are zero items and minGroups is 0', () => {
    expect(hasEnoughForView([], 'item', getDate, 0)).toBe(true);
  });
});

