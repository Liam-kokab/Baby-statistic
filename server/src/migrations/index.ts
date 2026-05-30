type TMigration = {
  name: string;
  up: string;
};

const rand = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const dt = (daysAgo: number, minutesFromMidnight: number): string =>
  `datetime('now', '-${daysAgo} days', 'start of day', '+${minutesFromMidnight} minutes')`;

const buildSeedSql = (): string => {
  const parts: string[] = [];
  const servedStatuses = ['FRIDGE', 'FREEZER', 'USED', 'EXPIRED'] as const;

  [6, 5, 4, 3, 2, 1, 0].forEach((day) => {
    [360, 660, 960].forEach((base) => {
      const startMin = base + rand(0, 60);
      const amount = rand(100, 200);
      const status = servedStatuses[rand(0, servedStatuses.length - 1)];
      const expiryOffset = rand(1, 5);
      parts.push(
        `INSERT INTO served_milk (amount, original_amount, status, expiry_date, created_at) VALUES ` +
          `(${amount}, ${amount}, '${status}', datetime('now', '+${expiryOffset} days'), ` +
          `${dt(day, startMin)});`,
      );
    });
    [300, 570, 840, 1110].forEach((base) => {
      const startMin = base + rand(0, 45);
      const amount = rand(100, 150);
      const source = rand(0, 1) === 0 ? 'FRIDGE' : 'FREEZER';
      parts.push(
        `INSERT INTO drank_milk (amount, source, created_at) VALUES ` +
          `(${amount}, '${source}', ${dt(day, startMin)});`,
      );
    });
    Array.from({ length: 5 }).forEach((_, i) => {
      const startMin = 240 + i * 210 + rand(0, 60);
      parts.push(`INSERT INTO poop (created_at) VALUES (${dt(day, startMin)});`);
    });
    Array.from({ length: 6 }).forEach((_, i) => {
      const startMin = 180 + i * 180 + rand(0, 60);
      parts.push(`INSERT INTO pee (created_at) VALUES (${dt(day, startMin)});`);
    });
    [30, 390, 750, 1110].forEach((base) => {
      const startMin = base + rand(0, 30);
      const endMin = startMin + rand(60, 120);
      parts.push(
        `INSERT INTO sleep (start, end, created_at) VALUES ` +
          `(${dt(day, startMin)}, ${dt(day, endMin)}, ${dt(day, startMin)});`,
      );
    });
  });

  return parts.join('\n');
};

const isDev = process.env.NODE_ENV !== 'production';

export const migrations: TMigration[] = [
  {
    name: '001_schema',
    up: `
      CREATE TABLE IF NOT EXISTS served_milk (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        amount          INTEGER NOT NULL,
        original_amount INTEGER NOT NULL DEFAULT 0,
        status          TEXT    NOT NULL DEFAULT 'FRIDGE'
                          CHECK(status IN ('FRIDGE', 'FREEZER', 'USED', 'EXPIRED')),
        expiry_date     TEXT,
        created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TRIGGER IF NOT EXISTS served_milk_updated_at
      AFTER UPDATE ON served_milk FOR EACH ROW
      BEGIN
        UPDATE served_milk SET updated_at = datetime('now') WHERE id = OLD.id;
      END;

      CREATE TABLE IF NOT EXISTS drank_milk (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        amount     INTEGER NOT NULL,
        source     TEXT    NOT NULL DEFAULT 'FRIDGE'
                     CHECK(source IN ('FRIDGE', 'FREEZER')),
        created_at TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TRIGGER IF NOT EXISTS drank_milk_updated_at
      AFTER UPDATE ON drank_milk FOR EACH ROW
      BEGIN
        UPDATE drank_milk SET updated_at = datetime('now') WHERE id = OLD.id;
      END;

      CREATE TABLE IF NOT EXISTS sleep (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        start      TEXT    NOT NULL,
        end        TEXT,
        created_at TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TRIGGER IF NOT EXISTS sleep_updated_at
      AFTER UPDATE ON sleep FOR EACH ROW
      BEGIN
        UPDATE sleep SET updated_at = datetime('now') WHERE id = OLD.id;
      END;

      CREATE TABLE IF NOT EXISTS pee (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TRIGGER IF NOT EXISTS pee_updated_at
      AFTER UPDATE ON pee FOR EACH ROW
      BEGIN
        UPDATE pee SET updated_at = datetime('now') WHERE id = OLD.id;
      END;

      CREATE TABLE IF NOT EXISTS poop (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TRIGGER IF NOT EXISTS poop_updated_at
      AFTER UPDATE ON poop FOR EACH ROW
      BEGIN
        UPDATE poop SET updated_at = datetime('now') WHERE id = OLD.id;
      END;
    `,
  },

  // Dev only — seed test data
  ...(isDev ? [{ name: '002_seed_test_data', up: buildSeedSql() }] : []),

  {
    name: '003_oslo_triggers',
    up: `
      DROP TRIGGER IF EXISTS served_milk_updated_at;
      DROP TRIGGER IF EXISTS drank_milk_updated_at;
      DROP TRIGGER IF EXISTS sleep_updated_at;
      DROP TRIGGER IF EXISTS pee_updated_at;
      DROP TRIGGER IF EXISTS poop_updated_at;

      CREATE TRIGGER served_milk_updated_at
      AFTER UPDATE ON served_milk FOR EACH ROW
      BEGIN
        UPDATE served_milk SET updated_at = now_oslo() WHERE id = OLD.id;
      END;

      CREATE TRIGGER drank_milk_updated_at
      AFTER UPDATE ON drank_milk FOR EACH ROW
      BEGIN
        UPDATE drank_milk SET updated_at = now_oslo() WHERE id = OLD.id;
      END;

      CREATE TRIGGER sleep_updated_at
      AFTER UPDATE ON sleep FOR EACH ROW
      BEGIN
        UPDATE sleep SET updated_at = now_oslo() WHERE id = OLD.id;
      END;

      CREATE TRIGGER pee_updated_at
      AFTER UPDATE ON pee FOR EACH ROW
      BEGIN
        UPDATE pee SET updated_at = now_oslo() WHERE id = OLD.id;
      END;

      CREATE TRIGGER poop_updated_at
      AFTER UPDATE ON poop FOR EACH ROW
      BEGIN
        UPDATE poop SET updated_at = now_oslo() WHERE id = OLD.id;
      END;
    `,
  },

  // Production only — clears seed data from any existing DB that had 002 applied
  ...(!isDev ? [{
    name: '004_clear_test_data',
    up: `
      DELETE FROM served_milk;
      DELETE FROM drank_milk;
      DELETE FROM sleep;
      DELETE FROM pee;
      DELETE FROM poop;
      DELETE FROM sqlite_sequence WHERE name IN ('served_milk','drank_milk','sleep','pee','poop');
    `,
  }] : []),

  {
    name: '005_drank_milk_boob_source',
    up: `
      CREATE TABLE drank_milk_new (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        amount     INTEGER NOT NULL,
        source     TEXT    NOT NULL DEFAULT 'FRIDGE'
                     CHECK(source IN ('FRIDGE', 'FREEZER', 'BOOB')),
        created_at TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO drank_milk_new SELECT * FROM drank_milk;
      DROP TABLE drank_milk;
      ALTER TABLE drank_milk_new RENAME TO drank_milk;
      CREATE TRIGGER drank_milk_updated_at
      AFTER UPDATE ON drank_milk FOR EACH ROW
      BEGIN
        UPDATE drank_milk SET updated_at = now_oslo() WHERE id = OLD.id;
      END;
    `,
  },

  {
    name: '006_medicine',
    up: `
      CREATE TABLE IF NOT EXISTS medicine (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        name           TEXT    NOT NULL,
        interval_hours INTEGER NOT NULL DEFAULT 8,
        start_time     TEXT    NOT NULL DEFAULT '08:00',
        is_active      INTEGER NOT NULL DEFAULT 1,
        created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TRIGGER IF NOT EXISTS medicine_updated_at
      AFTER UPDATE ON medicine FOR EACH ROW
      BEGIN
        UPDATE medicine SET updated_at = now_oslo() WHERE id = OLD.id;
      END;

      CREATE TABLE IF NOT EXISTS medicine_log (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        medicine_id INTEGER NOT NULL,
        taken_at    TEXT    NOT NULL,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TRIGGER IF NOT EXISTS medicine_log_updated_at
      AFTER UPDATE ON medicine_log FOR EACH ROW
      BEGIN
        UPDATE medicine_log SET updated_at = now_oslo() WHERE id = OLD.id;
      END;
    `,
  },

  {
    name: '007_drop_updated_at',
    up: `
      DROP TRIGGER IF EXISTS served_milk_updated_at;
      DROP TRIGGER IF EXISTS drank_milk_updated_at;
      DROP TRIGGER IF EXISTS sleep_updated_at;
      DROP TRIGGER IF EXISTS pee_updated_at;
      DROP TRIGGER IF EXISTS poop_updated_at;
      DROP TRIGGER IF EXISTS medicine_updated_at;
      DROP TRIGGER IF EXISTS medicine_log_updated_at;

      CREATE TABLE served_milk_new AS SELECT id, amount, original_amount, status, expiry_date, created_at FROM served_milk;
      DROP TABLE served_milk;
      ALTER TABLE served_milk_new RENAME TO served_milk;

      CREATE TABLE drank_milk_new AS SELECT id, amount, source, created_at FROM drank_milk;
      DROP TABLE drank_milk;
      ALTER TABLE drank_milk_new RENAME TO drank_milk;

      CREATE TABLE sleep_new AS SELECT id, start, "end", created_at FROM sleep;
      DROP TABLE sleep;
      ALTER TABLE sleep_new RENAME TO sleep;

      CREATE TABLE pee_new AS SELECT id, created_at FROM pee;
      DROP TABLE pee;
      ALTER TABLE pee_new RENAME TO pee;

      CREATE TABLE poop_new AS SELECT id, created_at FROM poop;
      DROP TABLE poop;
      ALTER TABLE poop_new RENAME TO poop;

      CREATE TABLE medicine_new AS SELECT id, name, interval_hours, start_time, is_active, created_at FROM medicine;
      DROP TABLE medicine;
      ALTER TABLE medicine_new RENAME TO medicine;

      CREATE TABLE medicine_log_new AS SELECT id, medicine_id, taken_at, created_at FROM medicine_log;
      DROP TABLE medicine_log;
      ALTER TABLE medicine_log_new RENAME TO medicine_log;
    `,
  },

  {
    name: '008b_fix_primary_keys',
    up: `
      DROP TABLE IF EXISTS served_milk_pk;
      CREATE TABLE served_milk_pk (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        amount          INTEGER NOT NULL,
        original_amount INTEGER NOT NULL DEFAULT 0,
        status          TEXT    NOT NULL DEFAULT 'FRIDGE',
        expiry_date     TEXT,
        created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO served_milk_pk (id, amount, original_amount, status, expiry_date, created_at)
        SELECT rowid, amount, original_amount, status, expiry_date, created_at FROM served_milk;
      DROP TABLE served_milk;
      ALTER TABLE served_milk_pk RENAME TO served_milk;

      DROP TABLE IF EXISTS drank_milk_pk;
      CREATE TABLE drank_milk_pk (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        amount     INTEGER NOT NULL,
        source     TEXT    NOT NULL DEFAULT 'FRIDGE',
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO drank_milk_pk (id, amount, source, created_at)
        SELECT rowid, amount, source, created_at FROM drank_milk;
      DROP TABLE drank_milk;
      ALTER TABLE drank_milk_pk RENAME TO drank_milk;

      DROP TABLE IF EXISTS sleep_pk;
      CREATE TABLE sleep_pk (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        start      TEXT    NOT NULL,
        end        TEXT,
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO sleep_pk (id, start, "end", created_at)
        SELECT rowid, start, "end", created_at FROM sleep;
      DROP TABLE sleep;
      ALTER TABLE sleep_pk RENAME TO sleep;

      DROP TABLE IF EXISTS pee_pk;
      CREATE TABLE pee_pk (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO pee_pk (id, created_at) SELECT rowid, created_at FROM pee;
      DROP TABLE pee;
      ALTER TABLE pee_pk RENAME TO pee;

      DROP TABLE IF EXISTS poop_pk;
      CREATE TABLE poop_pk (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO poop_pk (id, created_at) SELECT rowid, created_at FROM poop;
      DROP TABLE poop;
      ALTER TABLE poop_pk RENAME TO poop;

      DROP TABLE IF EXISTS medicine_pk;
      CREATE TABLE medicine_pk (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        name           TEXT    NOT NULL,
        interval_hours INTEGER NOT NULL DEFAULT 8,
        start_time     TEXT    NOT NULL DEFAULT '08:00',
        is_active      INTEGER NOT NULL DEFAULT 1,
        created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO medicine_pk (id, name, interval_hours, start_time, is_active, created_at)
        SELECT rowid, name, interval_hours, start_time, is_active, created_at FROM medicine;
      DROP TABLE medicine;
      ALTER TABLE medicine_pk RENAME TO medicine;

      DROP TABLE IF EXISTS medicine_log_pk;
      CREATE TABLE medicine_log_pk (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        medicine_id INTEGER NOT NULL,
        taken_at    TEXT    NOT NULL,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO medicine_log_pk (id, medicine_id, taken_at, created_at)
        SELECT rowid, medicine_id, taken_at, created_at FROM medicine_log;
      DROP TABLE medicine_log;
      ALTER TABLE medicine_log_pk RENAME TO medicine_log;
    `,
  },

  {
    name: '009_pumping',
    up: `
      CREATE TABLE IF NOT EXISTS pumping (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },

  {
    name: '010_simplify_medicine',
    up: `
      CREATE TABLE medicine_simple (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL,
        is_active  INTEGER NOT NULL DEFAULT 1,
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO medicine_simple (id, name, is_active, created_at)
        SELECT id, name, is_active, created_at FROM medicine;
      DROP TABLE medicine;
      ALTER TABLE medicine_simple RENAME TO medicine;
    `,
  },
  {
    name: '011_prediction_logs',
    up: `
      CREATE TABLE IF NOT EXISTS prediction_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        predicted_amount INTEGER NOT NULL,
        actual_id INTEGER NULL,
        -- debugging fields
        raw_prediction REAL NULL,
        observed_max INTEGER NULL,
        recency_factor REAL NULL,
        rounding_step INTEGER NULL
      );
    `,
  },
  {
    name: '012_prediction_logs_v2',
    up: `
      -- Remove any existing prediction_log data by dropping the table if it exists,
      -- then recreate it with the requested column set.
      DROP TABLE IF EXISTS prediction_log;

      CREATE TABLE prediction_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        predicted_amount INTEGER NOT NULL,
        -- actual_id references a drank_milk row (the 'actual' drink that matched the prediction)
        actual_id INTEGER NULL REFERENCES drank_milk(id) ON DELETE SET NULL,
        raw_prediction REAL NULL,
        suggestBasedOnTwoHour REAL NULL,
        suggestBasedOnFourHour REAL NULL,
        suggestBasedOnSixHour REAL NULL
      );
      CREATE INDEX IF NOT EXISTS idx_prediction_log_actual_id ON prediction_log(actual_id);
    `,
  },
];







