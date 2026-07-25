import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';

vi.mock('fs');

describe('stateService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when the state file does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const { getCurrentIp } = await import('./stateService');

    expect(getCurrentIp()).toBeNull();
  });

  it('returns the trimmed IP when the state file exists', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('1.2.3.4\n' as unknown as Buffer);
    const { getCurrentIp } = await import('./stateService');

    expect(getCurrentIp()).toBe('1.2.3.4');
  });

  it('creates the data directory and writes the IP when setting current IP', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const { setCurrentIp } = await import('./stateService');

    setCurrentIp('5.6.7.8');

    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), '5.6.7.8\n', 'utf-8');
  });
});

