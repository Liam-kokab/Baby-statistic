import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Directory holding persisted, gitignored secrets (see server/secrets in .gitignore).
// Each file contains nothing but the raw secret string — no JSON, no metadata.
const SECRETS_DIR = path.join(__dirname, '..', '..', 'secrets');

/**
 * Reads a secret from `server/secrets/<fileName>`, generating and persisting a new
 * random one on first use if the file doesn't exist yet. The file's only content is
 * the raw secret string. Once created, the same secret is reused across restarts.
 */
export const loadOrCreateSecret = (fileName: string): string => {
  const filePath = path.join(SECRETS_DIR, fileName);

  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8').trim();
  }

  fs.mkdirSync(SECRETS_DIR, { recursive: true });
  const secret = crypto.randomBytes(64).toString('hex');
  fs.writeFileSync(filePath, secret, 'utf-8');
  return secret;
};

