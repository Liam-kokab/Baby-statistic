import { describe, it, expect } from 'vitest';
import { loadConfig } from './config';

const validEnv = {
  DOMENESHOP_TOKEN: 'token123',
  DOMENESHOP_SECRET: 'secret123',
  DDNS_HOSTNAME: 'example.com',
};

describe('loadConfig', () => {
  it('loads valid config with defaults applied', () => {
    const config = loadConfig(validEnv);
    expect(config.DOMENESHOP_TOKEN).toBe('token123');
    expect(config.DOMENESHOP_SECRET).toBe('secret123');
    expect(config.DDNS_HOSTNAME).toBe('example.com');
    expect(config.IP_PROVIDER_URL).toBe('https://checkip.amazonaws.com');
    expect(config.POLL_INTERVAL_MS).toBe(300000);
    expect(config.HTTP_PORT).toBe(3000);
    expect(config.RETRY_MAX_ATTEMPTS).toBe(3);
    expect(config.RETRY_BASE_DELAY_MS).toBe(500);
  });

  it('allows overriding defaults', () => {
    const config = loadConfig({
      ...validEnv,
      IP_PROVIDER_URL: 'https://custom.example.com/ip',
      POLL_INTERVAL_MS: '60000',
      HTTP_PORT: '8080',
    });
    expect(config.IP_PROVIDER_URL).toBe('https://custom.example.com/ip');
    expect(config.POLL_INTERVAL_MS).toBe(60000);
    expect(config.HTTP_PORT).toBe(8080);
  });

  it('throws a descriptive error when required variables are missing', () => {
    expect(() => loadConfig({})).toThrow(/DOMENESHOP_TOKEN/);
  });

  it('throws a descriptive error when DDNS_HOSTNAME is missing', () => {
    expect(() =>
      loadConfig({ DOMENESHOP_TOKEN: 'a', DOMENESHOP_SECRET: 'b' })
    ).toThrow(/DDNS_HOSTNAME/);
  });

  it('throws when IP_PROVIDER_URL is not a valid URL', () => {
    expect(() => loadConfig({ ...validEnv, IP_PROVIDER_URL: 'not-a-url' })).toThrow();
  });
});

