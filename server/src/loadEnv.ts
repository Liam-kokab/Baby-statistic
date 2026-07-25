import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Loads environment variables from a .env file before any other module reads
// process.env — must be the very first import in server/src/index.ts.
//
// The .env file lives at the repo root (see .env.example there for the full list
// of supported variables). `process.cwd()` differs between dev and prod, so a
// couple of candidate locations are checked, same pattern as resolveOpenApiPath
// in index.ts:
const candidates = [
  path.resolve(process.cwd(), '.env'),       // prod: cwd = repo root (see ecosystem.config.js)
  path.resolve(process.cwd(), '..', '.env'), // dev:  cwd = server/ (npm run dev -w server)
];
const envPath = candidates.find((p) => fs.existsSync(p));
if (envPath) {
  dotenv.config({ path: envPath });
}

