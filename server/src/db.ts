import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
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

const seedAdminUser = (db: Database.Database): void => {
  const username = process.env.SEED_ADMIN_USERNAME;
  const password = process.env.SEED_ADMIN_PASSWORD;

  const existing = db.prepare<[], { count: number }>(`SELECT COUNT(*) as count FROM users WHERE role = 'admin'`).get();
  if ((existing?.count ?? 0) > 0) return;

  if (!username || !password) {
    console.warn('[db] No admin user exists. Set SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD env vars to auto-create one.');
    return;
  }

  // Lazy-hash password using bcryptjs
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
  const hash = bcrypt.hashSync(password, rounds);
  const now = nowOslo();
  db.prepare<{ username: string; password_hash: string; created_at: string }>(
    `INSERT INTO users (username, password_hash, role, baby_id, name, created_at) VALUES (@username, @password_hash, 'admin', NULL, '', @created_at)`
  ).run({ username, password_hash: hash, created_at: now });
  console.log(`[db] Admin user '${username}' created.`);
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

  seedAdminUser(db);

  return db;
};

export const db = initDb();
