import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';

const db = new Database(path.join(__dirname, '..', '..', 'data', 'baby.db'));
const hash = bcrypt.hashSync('admin', 12);
const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

const existing = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
if (existing) {
  db.prepare("UPDATE users SET password_hash = ? WHERE username = 'admin'").run(hash);
  console.log("Updated password for existing 'admin' user.");
} else {
  db.prepare(
    "INSERT INTO users (username, password_hash, role, baby_id, config, created_at) VALUES ('admin', ?, 'admin', NULL, '{}', ?)"
  ).run(hash, now);
  console.log("Created admin user: admin / admin");
}

db.close();

