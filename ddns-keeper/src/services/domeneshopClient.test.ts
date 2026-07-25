import { describe, it, expect, vi, afterEach } from 'vitest';
import { updateDomeneshopIp } from './domeneshopClient';

describe('domeneshopClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const options = {
    token: 'my-token',
    secret: 'my-secret',
    retryMaxAttempts: 3,
    retryBaseDelayMs: 1,
  };

  it('sends a GET request with Basic Auth, hostname, and myip', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    await updateDomeneshopIp('example.com', '1.2.3.4', options);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url.toString()).toContain('/dyndns/update');
    expect(url.toString()).toContain('hostname=example.com');
    expect(url.toString()).toContain('myip=1.2.3.4');

    const expectedAuth = `Basic ${Buffer.from('my-token:my-secret').toString('base64')}`;
    expect(init.headers.Authorization).toBe(expectedAuth);
  });

  it('throws a detailed error on a non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized', text: async () => 'bad creds' })
    );

    await expect(updateDomeneshopIp('example.com', '1.2.3.4', options)).rejects.toThrow(/bad creds/);
  });

  it('does not retry on 4xx responses', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found', text: async () => 'not found' });
    vi.stubGlobal('fetch', fetchMock);

    await expect(updateDomeneshopIp('example.com', '1.2.3.4', options)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries on 5xx responses up to the configured max attempts', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Error', text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    await expect(updateDomeneshopIp('example.com', '1.2.3.4', options)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws a descriptive error when the network request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(updateDomeneshopIp('example.com', '1.2.3.4', options)).rejects.toThrow(/Failed to reach Domeneshop/);
  });
});

