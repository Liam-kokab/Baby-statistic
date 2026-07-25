import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';

// Loads environment variables from a .env file. Supports a single combined
// .env at the repo root (shared with server/src/loadEnv.ts) as well as a
// ddns-keeper-local override, for deployments where this app runs on its
// own outside the monorepo (e.g. Docker, systemd — see README.md).
// First candidate that exists wins; dotenv never overrides vars already set
// in process.env (e.g. by PM2's `env` block in ecosystem.config.js).
const envCandidates = [
  path.resolve(process.cwd(), '.env'),       // standalone deploy: cwd = ddns-keeper/
  path.resolve(__dirname, '..', '.env'),     // ddns-keeper/.env regardless of cwd
  path.resolve(__dirname, '..', '..', '.env'), // repo root .env (combined with server's)
];
const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));
if (envPath) {
  dotenv.config({ path: envPath });
}

const configSchema = z.object({
  DOMENESHOP_TOKEN: z.string().min(1, 'DOMENESHOP_TOKEN is required'),
  DOMENESHOP_SECRET: z.string().min(1, 'DOMENESHOP_SECRET is required'),
  DDNS_HOSTNAME: z.string().min(1, 'DDNS_HOSTNAME is required'),
  IP_PROVIDER_URL: z.string().url().default('https://checkip.amazonaws.com'),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(300000),
  HTTP_PORT: z.coerce.number().int().positive().default(3000),
  RETRY_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().default(500),
});

export type TDdnsConfig = z.infer<typeof configSchema>;

/**
 * Parses and validates configuration from environment variables. Throws a
 * descriptive error (via Zod) if required variables are missing/invalid.
 */
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): TDdnsConfig => {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid ddns-keeper configuration — ${issues}`);
  }
  return result.data;
};

let cachedConfig: TDdnsConfig | undefined;

/**
 * Returns the process-wide config singleton, loading (and validating) it
 * from process.env on first access. Lazy so importing this module never
 * throws — only actually resolving a config does.
 */
export const getConfig = (): TDdnsConfig => {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
};

