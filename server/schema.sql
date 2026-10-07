CREATE TABLE IF NOT EXISTS developers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'Dev',
  notes       TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  exclude_from_suggestions INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assignments (
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
  due_date      TEXT,
  day_part      TEXT NOT NULL DEFAULT 'FULL' CHECK (day_part IN ('FULL','AM','PM')),
  estimated_days INTEGER,
  preferred_developer_id INTEGER REFERENCES developers(id),
  is_fixed      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_assignments_developer ON assignments(developer_id);
CREATE INDEX IF NOT EXISTS idx_assignments_dates ON assignments(start_date, end_date);

CREATE TABLE IF NOT EXISTS holidays (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  date   TEXT NOT NULL UNIQUE,
  label  TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS developer_leaves (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  developer_id  INTEGER NOT NULL REFERENCES developers(id),
  start_date    TEXT NOT NULL,
  end_date      TEXT NOT NULL,
  reason        TEXT
);

CREATE TABLE IF NOT EXISTS activity_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  message     TEXT NOT NULL
);

-- Learned developer/task-keyword affinity, used by the local suggestion engine so it
-- needs Claude less often as real history accumulates.
CREATE TABLE IF NOT EXISTS task_affinity (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword       TEXT NOT NULL,
  developer_id  INTEGER NOT NULL REFERENCES developers(id),
  score         REAL NOT NULL DEFAULT 0,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(keyword, developer_id)
);

-- User-configurable settings (key/value), e.g. the Dashboard planner's look-ahead days.
CREATE TABLE IF NOT EXISTS app_settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
