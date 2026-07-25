import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';

vi.mock('fs');

describe('historyService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates the file with a CSV header when it does not exist yet', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const { appendIpHistory } = await import('./historyService');

    appendIpHistory('1.2.3.4', new Date('2026-01-01T00:00:00.000Z'));

    expect(fs.writeFileSync).toHaveBeenCalledWith(expect.any(String), 'timestamp,new_ip\n', 'utf-8');
    expect(fs.appendFileSync).toHaveBeenCalledWith(
      expect.any(String),
      '2026-01-01T00:00:00.000Z,1.2.3.4\n',
      'utf-8'
    );
  });

  it('never overwrites the file — only appends — when it already exists', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const { appendIpHistory } = await import('./historyService');

    appendIpHistory('9.9.9.9', new Date('2026-02-02T00:00:00.000Z'));

    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(fs.appendFileSync).toHaveBeenCalledWith(
      expect.any(String),
      '2026-02-02T00:00:00.000Z,9.9.9.9\n',
      'utf-8'
    );
  });
});

