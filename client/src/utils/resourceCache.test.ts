import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TDataOrError } from 'baby-statistic-common';
import {
  clearResourceCache,
  fetchResource,
  getResourceEntry,
  isEntryDirty,
  markAllResourcesDirty,
  markResourceDirty,
  registerResourceDependencies,
  subscribeAnyResourceChange,
  subscribeResourceEntry,
  subscribeResourceKind,
} from './resourceCache';
import type { TResource } from './resourceKeys';

const ok = <T,>(data: T): TDataOrError<T> => ({ ok: true, data });
const err = (): TDataOrError<never> => ({ ok: false, error: 'boom' });

afterEach(() => {
  // Every test starts from a clean module-level cache — mirrors what `clearResourceCache`
  // already does for real on logout, just invoked here so tests don't leak into each other.
  clearResourceCache();
});

describe('resourceCache', () => {
  it('creates a fresh entry as dirty and unfetched', () => {
    const entry = getResourceEntry('key-a');
    expect(entry.data).toBeNull();
    expect(entry.lastUpdatedAt).toBeNull();
    expect(entry.isError).toBe(false);
    expect(isEntryDirty(entry)).toBe(true);
  });

  it('fetchResource populates data and clears dirty on success', async () => {
    const key = 'served-milk-total';
    registerResourceDependencies(key, ['servedMilk']);

    await fetchResource(key, () => Promise.resolve(ok({ fridge: 1, freezer: 2, total: 3 })));

    const entry = getResourceEntry(key);
    expect(entry.data).toEqual({ fridge: 1, freezer: 2, total: 3 });
    expect(entry.isError).toBe(false);
    expect(entry.lastUpdatedAt).not.toBeNull();
    expect(isEntryDirty(entry)).toBe(false);
  });

  it('fetchResource sets isError on failure without throwing', async () => {
    const key = 'sleep-summary';
    await fetchResource(key, () => Promise.resolve(err()));

    const entry = getResourceEntry(key);
    expect(entry.isError).toBe(true);
    expect(entry.data).toBeNull();
    expect(entry.loading).toBe(false);
  });

  it('dedupes concurrent fetchResource calls for the same key', async () => {
    const key = 'dedupe-key';
    const fetcher = vi.fn(() => Promise.resolve(ok('value')));

    await Promise.all([fetchResource(key, fetcher), fetchResource(key, fetcher)]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(getResourceEntry(key).data).toBe('value');
  });

  it('markResourceDirty only dirties entries that depend on that resource', async () => {
    const sleepKey = 'sleep-key';
    const milkKey = 'milk-key';
    registerResourceDependencies(sleepKey, ['sleep']);
    registerResourceDependencies(milkKey, ['drankMilk']);
    await fetchResource(sleepKey, () => Promise.resolve(ok('sleep-data')));
    await fetchResource(milkKey, () => Promise.resolve(ok('milk-data')));

    expect(isEntryDirty(getResourceEntry(sleepKey))).toBe(false);
    expect(isEntryDirty(getResourceEntry(milkKey))).toBe(false);

    markResourceDirty('sleep');

    expect(isEntryDirty(getResourceEntry(sleepKey))).toBe(true);
    expect(isEntryDirty(getResourceEntry(milkKey))).toBe(false);
  });

  it('markAllResourcesDirty dirties every entry regardless of its resources', async () => {
    const a = 'a-key';
    const b = 'b-key';
    registerResourceDependencies(a, ['sleep']);
    registerResourceDependencies(b, ['pumping']);
    await fetchResource(a, () => Promise.resolve(ok('a')));
    await fetchResource(b, () => Promise.resolve(ok('b')));

    markAllResourcesDirty();

    expect(isEntryDirty(getResourceEntry(a))).toBe(true);
    expect(isEntryDirty(getResourceEntry(b))).toBe(true);
  });

  it('a repeated dirty mark keeps the entry dirty even across an in-between fetch', async () => {
    const key = 'repeat-dirty-key';
    registerResourceDependencies(key, ['medicine']);
    await fetchResource(key, () => Promise.resolve(ok('v1')));
    expect(isEntryDirty(getResourceEntry(key))).toBe(false);

    markResourceDirty('medicine');
    expect(isEntryDirty(getResourceEntry(key))).toBe(true);

    await fetchResource(key, () => Promise.resolve(ok('v2')));
    expect(isEntryDirty(getResourceEntry(key))).toBe(false);
    expect(getResourceEntry(key).data).toBe('v2');
  });

  it('registerResourceDependencies is additive and idempotent', () => {
    const key = 'multi-resource-key';
    registerResourceDependencies(key, ['sleep']);
    registerResourceDependencies(key, ['sleep', 'pumping']);

    markResourceDirty('pumping');
    expect(isEntryDirty(getResourceEntry(key))).toBe(true);
  });

  it('clearResourceCache wipes data and resets dirty state for a fresh entry', async () => {
    const key = 'clear-me';
    await fetchResource(key, () => Promise.resolve(ok('some-data')));
    expect(getResourceEntry(key).data).toBe('some-data');

    clearResourceCache();

    const entry = getResourceEntry(key);
    expect(entry.data).toBeNull();
    expect(isEntryDirty(entry)).toBe(true);
  });

  it('notifies subscribers when an entry changes', async () => {
    const key = 'notify-key';
    const listener = vi.fn();
    const unsubscribe = subscribeResourceEntry(key, listener);

    await fetchResource(key, () => Promise.resolve(ok('data')));
    expect(listener).toHaveBeenCalled();

    unsubscribe();
    listener.mockClear();
    await fetchResource(key, () => Promise.resolve(ok('more-data')));
    expect(listener).not.toHaveBeenCalled();
  });

  it('subscribeResourceKind only fires for the matching resource', () => {
    const sleepListener = vi.fn();
    const pumpingListener = vi.fn();
    const unsubscribeSleep = subscribeResourceKind('sleep', sleepListener);
    const unsubscribePumping = subscribeResourceKind('pumping', pumpingListener);

    markResourceDirty('sleep');

    expect(sleepListener).toHaveBeenCalledTimes(1);
    expect(pumpingListener).not.toHaveBeenCalled();

    unsubscribeSleep();
    unsubscribePumping();
  });

  it('subscribeAnyResourceChange fires on markAllResourcesDirty', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAnyResourceChange(listener);

    markAllResourcesDirty();

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('every declared TResource can be marked dirty without throwing', () => {
    const resources: TResource[] = ['servedMilk', 'drankMilk', 'sleep', 'nappy', 'medicine', 'pumping', 'milestone'];
    resources.forEach((resource) => expect(() => markResourceDirty(resource)).not.toThrow());
  });
});


