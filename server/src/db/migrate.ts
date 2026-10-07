import type Database from "better-sqlite3";

interface ColumnInfo {
  name: string;
  notnull: number;
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as ColumnInfo[];
  return columns.some((c) => c.name === column);
}

/**
 * Relaxes developer_id/start_date/end_date to nullable so assignments can
 * live in the Backlog (missing developer and/or dates) before being
 * scheduled. Rebuilds the table since SQLite can't drop a NOT NULL
 * constraint in place — existing rows are preserved.
 */
function migrateNullableAssignmentFields(db: Database.Database): void {
  const columns = db.prepare("PRAGMA table_info(assignments)").all() as ColumnInfo[];
  const startCol = columns.find((c) => c.name === "start_date");
  if (startCol?.notnull !== 1) return;

  db.exec(`
    BEGIN TRANSACTION;

    CREATE TABLE assignments_new (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      developer_id  INTEGER REFERENCES developers(id),
      task_name     TEXT NOT NULL,
      start_date    TEXT,
      end_date      TEXT,
      duration_days INTEGER GENERATED ALWAYS AS (
        CASE WHEN start_date IS NOT NULL AND end_date IS NOT NULL
             THEN julianday(end_date) - julianday(start_date) + 1
             ELSE NULL END
      ) STORED,
      priority      TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('High','Medium','Low')),
      status        TEXT NOT NULL DEFAULT 'Planned' CHECK (status IN ('Planned','Ongoing','Completed','On Hold')),
      is_urgent     INTEGER NOT NULL DEFAULT 0,
      notes         TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT INTO assignments_new
      (id, developer_id, task_name, start_date, end_date, priority, status, is_urgent, notes, created_at, updated_at)
    SELECT id, developer_id, task_name, start_date, end_date, priority, status, is_urgent, notes, created_at, updated_at
    FROM assignments;

    DROP TABLE assignments;
    ALTER TABLE assignments_new RENAME TO assignments;

    CREATE INDEX IF NOT EXISTS idx_assignments_developer ON assignments(developer_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_dates ON assignments(start_date, end_date);

    COMMIT;
  `);
}

/** Adds the due-date column backlog items need — a plain additive column, no rebuild required. */
function migrateAddDueDate(db: Database.Database): void {
  if (hasColumn(db, "assignments", "due_date")) return;
  db.exec(`ALTER TABLE assignments ADD COLUMN due_date TEXT`);
}

/** Adds half-day (AM/PM) support — additive column with a default, no rebuild required. */
function migrateAddDayPart(db: Database.Database): void {
  if (hasColumn(db, "assignments", "day_part")) return;
  db.exec(`ALTER TABLE assignments ADD COLUMN day_part TEXT NOT NULL DEFAULT 'FULL' CHECK (day_part IN ('FULL','AM','PM'))`);
}

/** Learned developer/task-keyword affinity table for the local suggestion engine. */
function migrateAddTaskAffinity(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_affinity (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword       TEXT NOT NULL,
      developer_id  INTEGER NOT NULL REFERENCES developers(id),
      score         REAL NOT NULL DEFAULT 0,
      updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(keyword, developer_id)
    )
  `);
}

/** Estimated work days for a backlog task — also feeds the suggestion engine's due-date fit check. */
function migrateAddEstimatedDays(db: Database.Database): void {
  if (hasColumn(db, "assignments", "estimated_days")) return;
  db.exec(`ALTER TABLE assignments ADD COLUMN estimated_days INTEGER`);
}

/** Marks a developer (e.g. the Software Lead) as excluded from AI allocation suggestions. */
function migrateAddExcludeFromSuggestions(db: Database.Database): void {
  if (hasColumn(db, "developers", "exclude_from_suggestions")) return;
  db.exec(`ALTER TABLE developers ADD COLUMN exclude_from_suggestions INTEGER NOT NULL DEFAULT 0`);
}

/** Optional developer a task must (or should) go to — e.g. prior experience or their own bug. */
function migrateAddPreferredDeveloper(db: Database.Database): void {
  if (hasColumn(db, "assignments", "preferred_developer_id")) return;
  db.exec(`ALTER TABLE assignments ADD COLUMN preferred_developer_id INTEGER REFERENCES developers(id)`);
}

/** Fixed tasks are never auto-shifted (e.g. by an overrun cascade). */
function migrateAddIsFixed(db: Database.Database): void {
  if (hasColumn(db, "assignments", "is_fixed")) return;
  db.exec(`ALTER TABLE assignments ADD COLUMN is_fixed INTEGER NOT NULL DEFAULT 0`);
}

/** Simple key/value store for user-configurable app settings (e.g. planner look-ahead days). */
function migrateAddAppSettings(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key    TEXT PRIMARY KEY,
      value  TEXT NOT NULL
    )
  `);
}

export function runMigrations(db: Database.Database): void {
  migrateNullableAssignmentFields(db);
  migrateAddDueDate(db);
  migrateAddDayPart(db);
  migrateAddTaskAffinity(db);
  migrateAddEstimatedDays(db);
  migrateAddExcludeFromSuggestions(db);
  migrateAddPreferredDeveloper(db);
  migrateAddIsFixed(db);
  migrateAddAppSettings(db);
}
