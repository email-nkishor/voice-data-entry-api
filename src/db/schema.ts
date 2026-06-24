export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS student_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  client_id INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  class TEXT NOT NULL DEFAULT '',
  roll_no TEXT NOT NULL DEFAULT '',
  mobile TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  admission_no TEXT,
  parent_name TEXT,
  parent_mobile TEXT,
  academic_year TEXT,
  section TEXT,
  status TEXT NOT NULL DEFAULT 'new_admission',
  fee_status TEXT NOT NULL DEFAULT 'not_applicable',
  group_id INTEGER REFERENCES student_groups(id),
  custom_data TEXT,
  client_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_students_group_id ON students(group_id);
CREATE INDEX IF NOT EXISTS idx_students_client_id ON students(client_id);
CREATE INDEX IF NOT EXISTS idx_students_updated_at ON students(updated_at);

CREATE TABLE IF NOT EXISTS student_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  message TEXT NOT NULL,
  action_date TEXT NOT NULL,
  logged_date TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_student_activities_student_id ON student_activities(student_id);

CREATE TABLE IF NOT EXISTS lookup_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(category, value)
);

CREATE INDEX IF NOT EXISTS idx_lookup_options_category ON lookup_options(category);
`;
