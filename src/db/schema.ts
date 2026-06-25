export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  settings_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL DEFAULT 1 REFERENCES organizations(id),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  linked_student_id INTEGER,
  created_at TEXT NOT NULL,
  UNIQUE(organization_id, email)
);

CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  UNIQUE(module, action)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL,
  permission_id INTEGER NOT NULL REFERENCES permissions(id),
  scope TEXT NOT NULL DEFAULT 'all',
  UNIQUE(role, permission_id)
);

CREATE TABLE IF NOT EXISTS user_student_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL DEFAULT 1 REFERENCES organizations(id),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'guardian',
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, student_id)
);

CREATE TABLE IF NOT EXISTS student_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  description TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  client_id INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL DEFAULT 1,
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
CREATE INDEX IF NOT EXISTS idx_students_org_id ON students(organization_id);

CREATE TABLE IF NOT EXISTS group_students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL DEFAULT 1,
  group_id INTEGER NOT NULL REFERENCES student_groups(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  assigned_at TEXT NOT NULL,
  assigned_by INTEGER REFERENCES users(id),
  UNIQUE(group_id, student_id)
);

CREATE TABLE IF NOT EXISTS teacher_group_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL DEFAULT 1,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES student_groups(id) ON DELETE CASCADE,
  UNIQUE(user_id, group_id)
);

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

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'other',
  start_date TEXT NOT NULL,
  end_date TEXT,
  location TEXT,
  group_id INTEGER REFERENCES student_groups(id),
  created_by INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'draft',
  client_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_org_start ON events(organization_id, start_date);

CREATE TABLE IF NOT EXISTS event_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  registration_status TEXT NOT NULL DEFAULT 'registered',
  UNIQUE(event_id, student_id)
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL DEFAULT 1,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  group_id INTEGER REFERENCES student_groups(id),
  event_id INTEGER REFERENCES events(id),
  attendance_date TEXT NOT NULL,
  context_type TEXT NOT NULL DEFAULT 'daily',
  period_number INTEGER,
  status TEXT NOT NULL DEFAULT 'present',
  remarks TEXT,
  marked_by INTEGER REFERENCES users(id),
  client_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(organization_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_records(student_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_group ON attendance_records(group_id, attendance_date);

CREATE TABLE IF NOT EXISTS certificate_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  description TEXT,
  certificate_type TEXT NOT NULL DEFAULT 'achievement',
  template_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES users(id),
  client_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cert_templates_org ON certificate_templates(organization_id, is_active);

CREATE TABLE IF NOT EXISTS certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL DEFAULT 1,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  template_id INTEGER REFERENCES certificate_templates(id),
  certificate_number TEXT NOT NULL,
  certificate_type TEXT NOT NULL DEFAULT 'achievement',
  title TEXT NOT NULL,
  description TEXT,
  certificate_name TEXT NOT NULL,
  award_type TEXT NOT NULL DEFAULT 'other',
  issue_date TEXT NOT NULL,
  issued_by TEXT NOT NULL,
  attachment_url TEXT,
  verification_code TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'issued',
  revoked_at TEXT,
  revoked_by INTEGER REFERENCES users(id),
  revoke_reason TEXT,
  created_by INTEGER REFERENCES users(id),
  client_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_certificates_org ON certificates(organization_id, issue_date);
CREATE INDEX IF NOT EXISTS idx_certificates_student ON certificates(student_id, issue_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_number ON certificates(organization_id, certificate_number);

CREATE TABLE IF NOT EXISTS awards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL DEFAULT 1,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'academic',
  title TEXT NOT NULL,
  description TEXT,
  award_date TEXT NOT NULL,
  issued_by TEXT,
  attachment_url TEXT,
  certificate_id INTEGER REFERENCES certificates(id),
  status TEXT NOT NULL DEFAULT 'issued',
  recommended_by INTEGER REFERENCES users(id),
  verification_code TEXT UNIQUE,
  created_by INTEGER REFERENCES users(id),
  client_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_awards_org ON awards(organization_id, award_date);
CREATE INDEX IF NOT EXISTS idx_awards_student ON awards(student_id, award_date);

CREATE TABLE IF NOT EXISTS voice_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL DEFAULT 1,
  student_id INTEGER REFERENCES students(id),
  entity_type TEXT,
  entity_id INTEGER,
  module_code TEXT NOT NULL,
  transcript TEXT NOT NULL,
  processed_json TEXT,
  audio_url TEXT,
  speech_engine TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by INTEGER REFERENCES users(id),
  client_id INTEGER,
  created_at TEXT NOT NULL,
  modified_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_voice_entries_org ON voice_entries(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_voice_entries_student ON voice_entries(student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_voice_entries_module ON voice_entries(module_code, created_at);

CREATE TABLE IF NOT EXISTS voice_entry_edits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voice_entry_id INTEGER NOT NULL REFERENCES voice_entries(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  edited_by INTEGER REFERENCES users(id),
  edited_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL DEFAULT 1,
  entity_type TEXT NOT NULL DEFAULT 'student',
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  is_required INTEGER NOT NULL DEFAULT 0,
  default_value TEXT,
  validation_rules_json TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  client_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(organization_id, entity_type, field_name)
);

CREATE INDEX IF NOT EXISTS idx_custom_field_defs_org ON custom_field_definitions(organization_id, entity_type, is_active);

CREATE TABLE IF NOT EXISTS custom_field_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL DEFAULT 1,
  field_definition_id INTEGER NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  value_text TEXT,
  client_id INTEGER,
  updated_at TEXT NOT NULL,
  UNIQUE(field_definition_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_custom_field_values_entity ON custom_field_values(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL DEFAULT 1,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  changes_json TEXT,
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lookup_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(category, value)
);

CREATE INDEX IF NOT EXISTS idx_lookup_options_category ON lookup_options(category);

CREATE TABLE IF NOT EXISTS parents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL DEFAULT 1 REFERENCES organizations(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  phone TEXT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  client_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(organization_id, email)
);

CREATE INDEX IF NOT EXISTS idx_parents_org ON parents(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_parents_user ON parents(user_id);

CREATE TABLE IF NOT EXISTS parent_student_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL DEFAULT 1 REFERENCES organizations(id),
  parent_id INTEGER NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL DEFAULT 'guardian',
  is_primary_contact INTEGER NOT NULL DEFAULT 0,
  client_id INTEGER,
  created_at TEXT NOT NULL,
  UNIQUE(parent_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_mappings_parent ON parent_student_mappings(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_mappings_student ON parent_student_mappings(student_id);

CREATE TABLE IF NOT EXISTS parent_notification_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL DEFAULT 1 REFERENCES organizations(id),
  parent_id INTEGER NOT NULL UNIQUE REFERENCES parents(id) ON DELETE CASCADE,
  email_enabled INTEGER NOT NULL DEFAULT 1,
  sms_enabled INTEGER NOT NULL DEFAULT 0,
  push_enabled INTEGER NOT NULL DEFAULT 0,
  event_assigned INTEGER NOT NULL DEFAULT 1,
  certificate_issued INTEGER NOT NULL DEFAULT 1,
  award_added INTEGER NOT NULL DEFAULT 1,
  attendance_alert INTEGER NOT NULL DEFAULT 1,
  client_id INTEGER,
  updated_at TEXT NOT NULL
);
`;
