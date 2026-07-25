import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'ip-history.csv');
const CSV_HEADER = 'timestamp,new_ip';

const ensureDataDir = (): void => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const ensureHistoryFile = (): void => {
  ensureDataDir();
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, `${CSV_HEADER}\n`, 'utf-8');
  }
};

/**
 * Appends a `timestamp,new_ip` row to data/ip-history.csv. Creates the file
 * (with header) on first use. Never overwrites existing history — always
 * appends.
 */
export const appendIpHistory = (ip: string, timestamp: Date = new Date()): void => {
  ensureHistoryFile();
  fs.appendFileSync(HISTORY_FILE, `${timestamp.toISOString()},${ip}\n`, 'utf-8');
};

export const HISTORY_FILE_PATH = HISTORY_FILE;

