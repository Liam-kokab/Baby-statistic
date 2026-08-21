import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import BlackScreenOverlay from './BlackScreenOverlay';
import { LanguageProvider } from '../../i18n/i18n';
import type { TAlwaysOnDisplayData } from 'baby-statistic-common';
import { clearResourceCache } from '../../utils/resourceCache';

vi.mock('../../utils/authFetch', () => ({
  authFetch: vi.fn(),
}));
vi.mock('../../contexts/WsProvider', () => ({
  useWsConnected: () => true,
}));

const { authFetch } = await import('../../utils/authFetch');

const mockData: TAlwaysOnDisplayData = {
  latestSleep: { id: 1, start: '2026-08-22T06:00:00.000Z', end: null, createdAt: '2026-08-22T06:00:00.000Z' } as never,
  latestPumping: { id: 1, createdAt: '2026-08-22T05:00:00.000Z' } as never,
  latestDrank: { id: 1, amount: 120, source: 'FRIDGE', createdAt: '2026-08-22T04:00:00.000Z' } as never,
  drankToday: { todayMl: 350, avgPerDayLast10: 800, hasBoob: false },
  medicines: [{ id: 1, name: 'Vitamin D', isActive: true, latestLog: null } as never],
};

beforeEach(() => {
  clearResourceCache();
  localStorage.clear();
  vi.mocked(authFetch).mockReset();
  vi.mocked(authFetch).mockResolvedValue({ ok: true, data: mockData });
});

describe('BlackScreenOverlay', () => {
  it('renders real fetched values once the fetch resolves, not placeholders', async () => {
    render(
      <LanguageProvider>
        <BlackScreenOverlay
          isOpen
          isExitVisible={false}
          isCursorVisible
          onPointerActivity={() => {}}
          onClose={() => {}}
        />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/350\/800/)).toBeInTheDocument();
    });

    expect(screen.getByText(/120 ml/)).toBeInTheDocument();
    expect(screen.getByText(/Vitamin D/)).toBeInTheDocument();
  });
});

