import Database from 'better-sqlite3';

const MIGRATIONS: { version: number; sql: string[] }[] = [
  {
    version: 1,
    sql: [
      `INSERT OR IGNORE INTO schema_version (version) VALUES (0)`,
    ],
  },
  {
    version: 2,
    sql: [
      `ALTER TABLE users ADD COLUMN organization_id INTEGER NOT NULL DEFAULT 1`,
      `ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`,
      `ALTER TABLE users ADD COLUMN linked_student_id INTEGER`,
      `ALTER TABLE student_groups ADD COLUMN organization_id INTEGER NOT NULL DEFAULT 1`,
      `ALTER TABLE students ADD COLUMN organization_id INTEGER NOT NULL DEFAULT 1`,
    ],
  },
];

function columnExists(db: Database.Database, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((r) => r.name === column);
}

function safeAlter(db: Database.Database, table: string, column: string, ddl: string): void {
  if (!columnExists(db, table, column)) {
    db.exec(ddl);
  }
}

function migrateCertificatesTable(db: Database.Database): void {
  const tableExists = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='certificates'`)
    .get();
  if (!tableExists) {
    return;
  }

  safeAlter(db, 'certificates', 'template_id', `ALTER TABLE certificates ADD COLUMN template_id INTEGER`);
  safeAlter(db, 'certificates', 'certificate_number', `ALTER TABLE certificates ADD COLUMN certificate_number TEXT`);
  safeAlter(db, 'certificates', 'certificate_type', `ALTER TABLE certificates ADD COLUMN certificate_type TEXT NOT NULL DEFAULT 'achievement'`);
  safeAlter(db, 'certificates', 'title', `ALTER TABLE certificates ADD COLUMN title TEXT`);
  safeAlter(db, 'certificates', 'description', `ALTER TABLE certificates ADD COLUMN description TEXT`);
  safeAlter(db, 'certificates', 'status', `ALTER TABLE certificates ADD COLUMN status TEXT NOT NULL DEFAULT 'issued'`);
  safeAlter(db, 'certificates', 'revoked_at', `ALTER TABLE certificates ADD COLUMN revoked_at TEXT`);
  safeAlter(db, 'certificates', 'revoked_by', `ALTER TABLE certificates ADD COLUMN revoked_by INTEGER`);
  safeAlter(db, 'certificates', 'revoke_reason', `ALTER TABLE certificates ADD COLUMN revoke_reason TEXT`);

  db.exec(`
    UPDATE certificates SET title = certificate_name WHERE title IS NULL OR title = '';
    UPDATE certificates SET certificate_number = 'CERT-' || printf('%06d', id)
      WHERE certificate_number IS NULL OR certificate_number = '';
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS certificate_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      description TEXT,
      certificate_type TEXT NOT NULL DEFAULT 'achievement',
      template_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER,
      client_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS awards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL DEFAULT 1,
      student_id INTEGER NOT NULL,
      category TEXT NOT NULL DEFAULT 'academic',
      title TEXT NOT NULL,
      description TEXT,
      award_date TEXT NOT NULL,
      issued_by TEXT,
      attachment_url TEXT,
      certificate_id INTEGER,
      status TEXT NOT NULL DEFAULT 'issued',
      recommended_by INTEGER,
      verification_code TEXT UNIQUE,
      created_by INTEGER,
      client_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL DEFAULT 0
    )
  `);

  let currentVersion = 0;
  const versionRow = db.prepare('SELECT version FROM schema_version LIMIT 1').get() as
    | { version: number }
    | undefined;

  if (versionRow) {
    currentVersion = versionRow.version;
  } else {
    db.prepare('INSERT INTO schema_version (version) VALUES (0)').run();
  }

  // Safe column adds for v2 (idempotent)
  safeAlter(db, 'users', 'organization_id', `ALTER TABLE users ADD COLUMN organization_id INTEGER NOT NULL DEFAULT 1`);
  safeAlter(db, 'users', 'status', `ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`);
  safeAlter(db, 'users', 'linked_student_id', `ALTER TABLE users ADD COLUMN linked_student_id INTEGER`);
  safeAlter(db, 'student_groups', 'organization_id', `ALTER TABLE student_groups ADD COLUMN organization_id INTEGER NOT NULL DEFAULT 1`);
  safeAlter(db, 'students', 'organization_id', `ALTER TABLE students ADD COLUMN organization_id INTEGER NOT NULL DEFAULT 1`);

  safeAlter(db, 'custom_field_definitions', 'updated_at', `ALTER TABLE custom_field_definitions ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''`);
  safeAlter(db, 'custom_field_definitions', 'client_id', `ALTER TABLE custom_field_definitions ADD COLUMN client_id INTEGER`);
  safeAlter(db, 'custom_field_values', 'updated_at', `ALTER TABLE custom_field_values ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''`);
  safeAlter(db, 'custom_field_values', 'client_id', `ALTER TABLE custom_field_values ADD COLUMN client_id INTEGER`);

  safeAlter(db, 'voice_entries', 'client_id', `ALTER TABLE voice_entries ADD COLUMN client_id INTEGER`);

  migrateCertificatesTable(db);

  db.exec(`UPDATE users SET status = 'active' WHERE status IS NULL OR status = ''`);
  db.exec(`UPDATE users SET organization_id = 1 WHERE organization_id IS NULL`);

  db.exec(`UPDATE custom_field_definitions SET updated_at = created_at WHERE updated_at IS NULL OR updated_at = ''`);

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) {
      continue;
    }
    const run = db.transaction(() => {
      for (const sql of migration.sql) {
        db.exec(sql);
      }
      db.prepare('UPDATE schema_version SET version = ?').run(migration.version);
    });
    run();
    currentVersion = migration.version;
  }
}
