import { describe, it, expect, vi, afterEach } from 'vitest';
import { isValidIPv4, fetchPublicIp } from './ipService';

describe('ipService', () => {
  describe('isValidIPv4', () => {
    it('accepts valid IPv4 addresses', () => {
      expect(isValidIPv4('1.2.3.4')).toBe(true);
      expect(isValidIPv4('255.255.255.255')).toBe(true);
      expect(isValidIPv4('0.0.0.0')).toBe(true);
    });

    it('rejects invalid IPv4 addresses', () => {
      expect(isValidIPv4('256.1.1.1')).toBe(false);
      expect(isValidIPv4('1.2.3')).toBe(false);
      expect(isValidIPv4('not-an-ip')).toBe(false);
      expect(isValidIPv4('::1')).toBe(false);
      expect(isValidIPv4('')).toBe(false);
    });
  });

  describe('fetchPublicIp', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const options = { providerUrl: 'https://example.com/ip', retryMaxAttempts: 3, retryBaseDelayMs: 1 };

    it('trims whitespace and returns a valid IP', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, text: async () => '  1.2.3.4\n' })
      );

      const ip = await fetchPublicIp(options);
      expect(ip).toBe('1.2.3.4');
    });

    it('throws a descriptive error when the response is not a valid IPv4 address', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => 'not-an-ip' }));

      await expect(fetchPublicIp(options)).rejects.toThrow(/invalid IPv4/);
    });

    it('throws when the provider responds with a non-2xx status (no retry benefit, but still throws)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => '' }));

      await expect(fetchPublicIp(options)).rejects.toThrow(/status 500/);
    });

    it('does not retry on 4xx and throws immediately', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => '' });
      vi.stubGlobal('fetch', fetchMock);

      await expect(fetchPublicIp(options)).rejects.toThrow(/status 404/);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('throws a descriptive error when the network request fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));

      await expect(fetchPublicIp(options)).rejects.toThrow(/Failed to reach IP provider/);
    });
  });
});

