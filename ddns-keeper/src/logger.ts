import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'ddns.log');

const ensureLogDir = (): void => {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
};

export type TLogLevel = 'info' | 'warn' | 'error';

/**
 * Writes a structured, timestamped log line to both stdout and logs/ddns.log.
 */
const write = (level: TLogLevel, message: string, meta?: Record<string, unknown>): void => {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta ? { meta } : {}),
  });

  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }

  try {
    ensureLogDir();
    fs.appendFileSync(LOG_FILE, `${line}\n`);
  } catch {
    // Never let logging failures crash the app — stdout output above already succeeded.
  }
};

export const logger = {
  info: (message: string, meta?: Record<string, unknown>): void => write('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>): void => write('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>): void => write('error', message, meta),
};

