import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { migrations } from './migrations';
import { nowOslo } from './utils/time';

const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, '..', 'data', 'baby.db');

const ensureDir = (filePath: string): void => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const initDb = (): Database.Database => {
  ensureDir(DB_PATH);

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Register Oslo-time UDF used by triggers
  db.function('now_oslo', () => nowOslo());

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      applied_at TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(
    db.prepare<[], { name: string }>('SELECT name FROM _migrations').all().map(({ name }) => name)
  );

  const insert = db.prepare('INSERT INTO _migrations (name) VALUES (?)');

  migrations
    .filter(({ name }) => !applied.has(name))
    .forEach(({ name, up }) => {
      db.exec(up);
      insert.run(name);
      console.log(`[db] migration applied: ${name}`);
    });

  return db;
};

export const db = initDb();

