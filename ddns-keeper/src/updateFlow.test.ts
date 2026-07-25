import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TDdnsConfig } from './config';

const ipServiceMock = { fetchPublicIp: vi.fn() };
const stateServiceMock = { getCurrentIp: vi.fn(), setCurrentIp: vi.fn() };
const historyServiceMock = { appendIpHistory: vi.fn() };
const domeneshopClientMock = { updateDomeneshopIp: vi.fn() };

vi.mock('./services/ipService', () => ipServiceMock);
vi.mock('./services/stateService', () => stateServiceMock);
vi.mock('./services/historyService', () => historyServiceMock);
vi.mock('./services/domeneshopClient', () => domeneshopClientMock);
vi.mock('./logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const testConfig: TDdnsConfig = {
  DOMENESHOP_TOKEN: 'token',
  DOMENESHOP_SECRET: 'secret',
  DDNS_HOSTNAME: 'example.com',
  IP_PROVIDER_URL: 'https://example.com/ip',
  POLL_INTERVAL_MS: 300000,
  HTTP_PORT: 3000,
  RETRY_MAX_ATTEMPTS: 3,
  RETRY_BASE_DELAY_MS: 500,
};

describe('runUpdateFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stateServiceMock.getCurrentIp.mockReturnValue(null);
  });

  it('exits early without updating when the IP is unchanged', async () => {
    stateServiceMock.getCurrentIp.mockReturnValue('1.2.3.4');
    ipServiceMock.fetchPublicIp.mockResolvedValue('1.2.3.4');
    const { runUpdateFlow } = await import('./updateFlow');

    await runUpdateFlow(testConfig);

    expect(domeneshopClientMock.updateDomeneshopIp).not.toHaveBeenCalled();
    expect(historyServiceMock.appendIpHistory).not.toHaveBeenCalled();
    expect(stateServiceMock.setCurrentIp).not.toHaveBeenCalled();
  });

  it('updates Domeneshop, logs history, and saves state when the IP changed', async () => {
    stateServiceMock.getCurrentIp.mockReturnValue('1.1.1.1');
    ipServiceMock.fetchPublicIp.mockResolvedValue('2.2.2.2');
    domeneshopClientMock.updateDomeneshopIp.mockResolvedValue(undefined);
    const { runUpdateFlow } = await import('./updateFlow');

    await runUpdateFlow(testConfig);

    expect(domeneshopClientMock.updateDomeneshopIp).toHaveBeenCalledWith(
      'example.com',
      '2.2.2.2',
      expect.objectContaining({ token: 'token', secret: 'secret' })
    );
    expect(historyServiceMock.appendIpHistory).toHaveBeenCalledWith('2.2.2.2');
    expect(stateServiceMock.setCurrentIp).toHaveBeenCalledWith('2.2.2.2');
  });

  it('does not save the new IP or log history when the Domeneshop update fails', async () => {
    stateServiceMock.getCurrentIp.mockReturnValue('1.1.1.1');
    ipServiceMock.fetchPublicIp.mockResolvedValue('2.2.2.2');
    domeneshopClientMock.updateDomeneshopIp.mockRejectedValue(new Error('domeneshop down'));
    const { runUpdateFlow } = await import('./updateFlow');

    await expect(runUpdateFlow(testConfig)).rejects.toThrow('domeneshop down');

    expect(historyServiceMock.appendIpHistory).not.toHaveBeenCalled();
    expect(stateServiceMock.setCurrentIp).not.toHaveBeenCalled();
  });

  it('propagates errors from fetching the public IP', async () => {
    stateServiceMock.getCurrentIp.mockReturnValue('1.1.1.1');
    ipServiceMock.fetchPublicIp.mockRejectedValue(new Error('ip provider down'));
    const { runUpdateFlow } = await import('./updateFlow');

    await expect(runUpdateFlow(testConfig)).rejects.toThrow('ip provider down');
    expect(domeneshopClientMock.updateDomeneshopIp).not.toHaveBeenCalled();
  });
});

