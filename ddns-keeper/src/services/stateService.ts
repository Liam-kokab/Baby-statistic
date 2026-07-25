import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'current-ip.txt');

const ensureDataDir = (): void => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

/**
 * Reads the last known IP from data/current-ip.txt. Returns null if the file
 * does not exist yet (e.g. first run).
 */
export const getCurrentIp = (): string | null => {
  if (!fs.existsSync(STATE_FILE)) {
    return null;
  }
  const content = fs.readFileSync(STATE_FILE, 'utf-8').trim();
  return content.length > 0 ? content : null;
};

/**
 * Persists the given IP as the last known IP in data/current-ip.txt,
 * creating the data directory if necessary.
 */
export const setCurrentIp = (ip: string): void => {
  ensureDataDir();
  fs.writeFileSync(STATE_FILE, `${ip}\n`, 'utf-8');
};

export const STATE_FILE_PATH = STATE_FILE;

