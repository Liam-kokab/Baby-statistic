import crypto from 'crypto';
import type { TApiKey, TCreateApiKeyResponse } from 'baby-statistic-common';
import { apiKeyRepository } from '../repositories/apiKeyRepository';

// Prefix makes keys recognizable in logs/UIs without revealing anything about the secret itself.
const KEY_PREFIX = 'bsk_';

// API keys are high-entropy random tokens (not human-memorable passwords), so a fast
// cryptographic hash (SHA-256) is appropriate here — unlike passwords, brute-forcing a
// 256-bit random key isn't feasible regardless of hash speed, so the slow adaptive
// hashing used for passwords (bcrypt) would only add latency for no security benefit.
const hashKey = (rawKey: string): string =>
  crypto.createHash('sha256').update(rawKey).digest('hex');

const generateRawKey = (): string =>
  `${KEY_PREFIX}${crypto.randomBytes(32).toString('base64url')}`;

export const apiKeyService = {
  findAll: (): TApiKey[] => apiKeyRepository.findAll(),

  create: (name: string, createdBy: number): TCreateApiKeyResponse => {
    const rawKey = generateRawKey();
    const apiKey = apiKeyRepository.insert({ name, keyHash: hashKey(rawKey), createdBy });
    return { ...apiKey, key: rawKey };
  },

  delete: (id: number): boolean => apiKeyRepository.delete(id),

  /** Verifies a Bearer token against stored API keys. Returns the matching key's
   * `createdBy` user id (used only to populate `req.user`), or `null` if no match. */
  verify: (rawKey: string): { id: number } | null => {
    if (!rawKey.startsWith(KEY_PREFIX)) return null;
    const match = apiKeyRepository.findByHash(hashKey(rawKey));
    return match ? { id: match.id } : null;
  },
};

