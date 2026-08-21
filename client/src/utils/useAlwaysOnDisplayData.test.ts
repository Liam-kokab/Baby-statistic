import { describe, expect, it, vi, beforeEach } from 'vitest';
import { StrictMode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { TAlwaysOnDisplayData } from 'baby-statistic-common';
import useAlwaysOnDisplayData from './useAlwaysOnDisplayData';
import { clearResourceCache, markResourceDirty } from './resourceCache';
vi.mock('./authFetch', () => ({
  authFetch: vi.fn(),
}));
const { authFetch } = await import('./authFetch');
const mockData: TAlwaysOnDisplayData = {
  latestSleep: { id: 1, start: '2026-08-22T00:00:00.000Z', end: null, createdAt: '2026-08-22T00:00:00.000Z' } as never,
  latestPumping: null,
  latestDrank: null,
  drankToday: { todayMl: 120, avgPerDayLast10: 800, hasBoob: false },
  medicines: [],
};
beforeEach(() => {
  clearResourceCache();
  vi.mocked(authFetch).mockReset();
  vi.mocked(authFetch).mockResolvedValue({ ok: true, data: mockData });
});
describe('useAlwaysOnDisplayData', () => {
  it('does not fetch while inactive', () => {
    renderHook(({ active }) => useAlwaysOnDisplayData(active), { initialProps: { active: false } });
    expect(authFetch).not.toHaveBeenCalled();
  });
  it('fetches and exposes the data once the overlay becomes active', async () => {
    const { result, rerender } = renderHook(({ active }) => useAlwaysOnDisplayData(active), {
      initialProps: { active: false },
    });
    expect(result.current.data).toBeNull();
    act(() => {
      rerender({ active: true });
    });
    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });
    expect(result.current.data).toEqual(mockData);
    expect(result.current.lastUpdatedAt).not.toBeNull();
    expect(result.current.isError).toBe(false);
    expect(authFetch).toHaveBeenCalledTimes(1);
  });
  it('shows cached data instantly and still refetches every time the overlay re-opens', async () => {
    const { result, rerender } = renderHook(({ active }) => useAlwaysOnDisplayData(active), {
      initialProps: { active: false },
    });
    act(() => {
      rerender({ active: true });
    });
    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(authFetch).toHaveBeenCalledTimes(1);
    act(() => {
      rerender({ active: false });
    });
    expect(result.current.data).toEqual(mockData);
    act(() => {
      rerender({ active: true });
    });
    await waitFor(() => expect(authFetch).toHaveBeenCalledTimes(2));
  });
  it('still works correctly under React.StrictMode (matches main.tsx)', async () => {
    const { result, rerender } = renderHook(({ active }) => useAlwaysOnDisplayData(active), {
      initialProps: { active: false },
      wrapper: StrictMode,
    });
    act(() => {
      rerender({ active: true });
    });
    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });
  });

  it('refetches live while already open when a WebSocket update marks a dependent resource dirty', async () => {
    const { result, rerender } = renderHook(({ active }) => useAlwaysOnDisplayData(active), {
      initialProps: { active: false },
    });

    act(() => {
      rerender({ active: true });
    });
    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(authFetch).toHaveBeenCalledTimes(1);

    const updatedData: TAlwaysOnDisplayData = { ...mockData, drankToday: { todayMl: 500, avgPerDayLast10: 800, hasBoob: false } };
    vi.mocked(authFetch).mockResolvedValue({ ok: true, data: updatedData });

    // Simulates WsProvider marking this resource dirty on a live `update` message — the overlay
    // stays open the whole time (`active` never toggles), so this must be the *only* trigger.
    act(() => {
      markResourceDirty('drankMilk');
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(updatedData);
    });
  });
});
