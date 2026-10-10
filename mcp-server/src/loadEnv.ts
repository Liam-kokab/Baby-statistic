import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Loads the repo-root .env (MCP_API_KEY, BABY_API_URL, ...) before other modules read process.env.
// Must be the first import in index.ts. Existing env vars (e.g. set by PM2) are not overridden.
const candidates = [
  path.resolve(process.cwd(), '.env'), // prod: cwd = repo root
  path.resolve(process.cwd(), '..', '.env'), // dev: cwd = mcp-server/
];
const envPath = candidates.find((p) => fs.existsSync(p));
if (envPath) {
  // quiet: never write to stdout (would corrupt the stdio transport)
  dotenv.config({ path: envPath, quiet: true });
}

