import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { config } from '../config';
import {
  AttendanceFilters,
  AttendanceRecord,
  AuditLog,
  Award,
  AwardFilters,
  Certificate,
  CertificateFilters,
  CertificateTemplate,
  CustomFieldDefinition,
  CustomFieldFilters,
  CustomFieldValue,
  Event,
  EventFilters,
  EventParticipant,
  GroupStudent,
  LookupCategory,
  LookupMap,
  LookupOption,
  Organization,
  Permission,
  RolePermission,
  Student,
  StudentActivity,
  StudentGroup,
  TeacherGroupAssignment,
  User,
  UserStudentLink,
  Parent,
  ParentStudentMapping,
  ParentNotificationPreferences,
  VoiceEntry,
  VoiceEntryEdit,
  VoiceEntryFilters,
} from '../types';
import { findLegacyJsonPaths, migrateJsonToSqlite } from './migrate-json';
import { runMigrations } from './migrations';
import { DbRepository, IdTable } from './repository';
import { SCHEMA_SQL } from './schema';

export class SqliteRepository implements DbRepository {
  readonly driver = 'sqlite' as const;
  private readonly db: Database.Database;

  constructor(filePath: string) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(filePath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.exec(SCHEMA_SQL);
    runMigrations(this.db);

    for (const jsonPath of findLegacyJsonPaths(filePath)) {
      migrateJsonToSqlite(this.db, jsonPath);
    }
  }

  nextId(table: IdTable): number {
    const sqliteTable = this.toSqliteTable(table);
    const row = this.db
      .prepare(`SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM ${sqliteTable}`)
      .get() as { nextId: number };
    return row.nextId;
  }

  // Organizations

  getOrganization(id = 1): Organization | undefined {
    return this.db
      .prepare('SELECT * FROM organizations WHERE id = ?')
      .get(id) as Organization | undefined;
  }

  insertOrganization(org: Organization): void {
    this.db
      .prepare(`
        INSERT INTO organizations (id, name, code, settings_json, created_at, updated_at)
        VALUES (@id, @name, @code, @settings_json, @created_at, @updated_at)
      `)
      .run(org);
  }

  updateOrganization(org: Organization): boolean {
    const result = this.db
      .prepare(`
        UPDATE organizations SET
          name = @name,
          code = @code,
          settings_json = @settings_json,
          updated_at = @updated_at
        WHERE id = @id
      `)
      .run(org);
    return result.changes > 0;
  }

  countOrganizations(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM organizations').get() as {
      count: number;
    };
    return row.count;
  }

  // Users

  findUserByEmail(email: string): User | undefined {
    return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
  }

  findUserById(id: number): User | undefined {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  }

  listUsers(organizationId?: number): User[] {
    if (organizationId !== undefined) {
      return this.db
        .prepare('SELECT * FROM users WHERE organization_id = ? ORDER BY name ASC')
        .all(organizationId) as User[];
    }
    return this.db.prepare('SELECT * FROM users ORDER BY name ASC').all() as User[];
  }

  insertUser(user: User): void {
    this.db
      .prepare(`
        INSERT INTO users (
          id, organization_id, email, password_hash, name, role, status, linked_student_id, created_at
        ) VALUES (
          @id, @organization_id, @email, @password_hash, @name, @role, @status, @linked_student_id, @created_at
        )
      `)
      .run({
        ...user,
        organization_id: user.organization_id ?? 1,
      });
  }

  updateUser(user: User): boolean {
    const result = this.db
      .prepare(`
        UPDATE users SET
          organization_id = @organization_id,
          email = @email,
          password_hash = @password_hash,
          name = @name,
          role = @role,
          status = @status,
          linked_student_id = @linked_student_id
        WHERE id = @id
      `)
      .run(user);
    return result.changes > 0;
  }

  deleteUser(id: number): boolean {
    const result = this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return result.changes > 0;
  }

  countUsers(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number };
    return row.count;
  }

  // User-student links

  linkParentToStudent(link: UserStudentLink): void {
    this.db
      .prepare(`
        INSERT INTO user_student_links (
          id, organization_id, user_id, student_id, relationship, is_primary, created_at
        ) VALUES (
          @id, @organization_id, @user_id, @student_id, @relationship, @is_primary, @created_at
        )
      `)
      .run({
        ...link,
        organization_id: link.organization_id ?? 1,
      });
  }

  unlinkParentFromStudent(userId: number, studentId: number): boolean {
    const result = this.db
      .prepare('DELETE FROM user_student_links WHERE user_id = ? AND student_id = ?')
      .run(userId, studentId);
    return result.changes > 0;
  }

  getLinkedStudents(userId: number): UserStudentLink[] {
    return this.db
      .prepare('SELECT * FROM user_student_links WHERE user_id = ? ORDER BY is_primary DESC, id ASC')
      .all(userId) as UserStudentLink[];
  }

  listUserStudentLinksUpdatedSince(since: Date, organizationId = 1): UserStudentLink[] {
    return this.db
      .prepare(
        'SELECT * FROM user_student_links WHERE organization_id = ? AND created_at >= ? ORDER BY created_at ASC'
      )
      .all(organizationId, since.toISOString()) as UserStudentLink[];
  }

  getLinkedStudentIds(userId: number): number[] {
    const linkIds = (
      this.db
        .prepare('SELECT student_id FROM user_student_links WHERE user_id = ?')
        .all(userId) as { student_id: number }[]
    ).map((row) => row.student_id);
    const parentIds = this.getStudentIdsForParentUser(userId);
    return [...new Set([...linkIds, ...parentIds])];
  }

  listParents(organizationId = 1): Parent[] {
    return this.db
      .prepare('SELECT * FROM parents WHERE organization_id = ? ORDER BY last_name ASC, first_name ASC')
      .all(organizationId) as Parent[];
  }

  listParentsUpdatedSince(since: Date, organizationId = 1): Parent[] {
    return this.db
      .prepare(
        'SELECT * FROM parents WHERE organization_id = ? AND updated_at >= ? ORDER BY updated_at ASC'
      )
      .all(organizationId, since.toISOString()) as Parent[];
  }

  getParentById(id: number): Parent | undefined {
    return this.db.prepare('SELECT * FROM parents WHERE id = ?').get(id) as Parent | undefined;
  }

  getParentByUserId(userId: number): Parent | undefined {
    return this.db.prepare('SELECT * FROM parents WHERE user_id = ?').get(userId) as Parent | undefined;
  }

  getParentByClientId(clientId: number): Parent | undefined {
    return this.db.prepare('SELECT * FROM parents WHERE client_id = ?').get(clientId) as Parent | undefined;
  }

  insertParent(parent: Parent): void {
    this.db
      .prepare(`
        INSERT INTO parents (
          id, organization_id, first_name, last_name, email, phone, user_id, status,
          client_id, created_at, updated_at
        ) VALUES (
          @id, @organization_id, @first_name, @last_name, @email, @phone, @user_id, @status,
          @client_id, @created_at, @updated_at
        )
      `)
      .run(parent);
  }

  updateParent(parent: Parent): boolean {
    const result = this.db
      .prepare(`
        UPDATE parents SET
          first_name = @first_name,
          last_name = @last_name,
          email = @email,
          phone = @phone,
          user_id = @user_id,
          status = @status,
          updated_at = @updated_at
        WHERE id = @id
      `)
      .run(parent);
    return result.changes > 0;
  }

  countParents(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM parents').get() as { count: number };
    return row.count;
  }

  listParentMappings(parentId?: number, studentId?: number): ParentStudentMapping[] {
    let sql = 'SELECT * FROM parent_student_mappings WHERE 1=1';
    const params: unknown[] = [];
    if (parentId != null) {
      sql += ' AND parent_id = ?';
      params.push(parentId);
    }
    if (studentId != null) {
      sql += ' AND student_id = ?';
      params.push(studentId);
    }
    sql += ' ORDER BY is_primary_contact DESC, id ASC';
    return this.db.prepare(sql).all(...params) as ParentStudentMapping[];
  }

  listParentMappingsUpdatedSince(since: Date, organizationId = 1): ParentStudentMapping[] {
    return this.db
      .prepare(
        'SELECT * FROM parent_student_mappings WHERE organization_id = ? AND created_at >= ? ORDER BY created_at ASC'
      )
      .all(organizationId, since.toISOString()) as ParentStudentMapping[];
  }

  getParentMapping(parentId: number, studentId: number): ParentStudentMapping | undefined {
    return this.db
      .prepare('SELECT * FROM parent_student_mappings WHERE parent_id = ? AND student_id = ?')
      .get(parentId, studentId) as ParentStudentMapping | undefined;
  }

  insertParentMapping(mapping: ParentStudentMapping): void {
    this.db
      .prepare(`
        INSERT INTO parent_student_mappings (
          id, organization_id, parent_id, student_id, relationship_type,
          is_primary_contact, client_id, created_at
        ) VALUES (
          @id, @organization_id, @parent_id, @student_id, @relationship_type,
          @is_primary_contact, @client_id, @created_at
        )
      `)
      .run(mapping);
  }

  deleteParentMapping(parentId: number, studentId: number): boolean {
    const result = this.db
      .prepare('DELETE FROM parent_student_mappings WHERE parent_id = ? AND student_id = ?')
      .run(parentId, studentId);
    return result.changes > 0;
  }

  getStudentIdsForParentUser(userId: number): number[] {
    const parent = this.getParentByUserId(userId);
    if (!parent) {
      return [];
    }
    return this.listParentMappings(parent.id).map((m) => m.student_id);
  }

  getParentNotificationPreferences(parentId: number): ParentNotificationPreferences | undefined {
    return this.db
      .prepare('SELECT * FROM parent_notification_preferences WHERE parent_id = ?')
      .get(parentId) as ParentNotificationPreferences | undefined;
  }

  upsertParentNotificationPreferences(
    prefs: ParentNotificationPreferences
  ): ParentNotificationPreferences {
    const existing = this.getParentNotificationPreferences(prefs.parent_id);
    if (existing) {
      this.db
        .prepare(`
          UPDATE parent_notification_preferences SET
            email_enabled = @email_enabled,
            sms_enabled = @sms_enabled,
            push_enabled = @push_enabled,
            event_assigned = @event_assigned,
            certificate_issued = @certificate_issued,
            award_added = @award_added,
            attendance_alert = @attendance_alert,
            updated_at = @updated_at
          WHERE parent_id = @parent_id
        `)
        .run(prefs);
      return prefs;
    }
    this.db
      .prepare(`
        INSERT INTO parent_notification_preferences (
          id, organization_id, parent_id, email_enabled, sms_enabled, push_enabled,
          event_assigned, certificate_issued, award_added, attendance_alert,
          client_id, updated_at
        ) VALUES (
          @id, @organization_id, @parent_id, @email_enabled, @sms_enabled, @push_enabled,
          @event_assigned, @certificate_issued, @award_added, @attendance_alert,
          @client_id, @updated_at
        )
      `)
      .run(prefs);
    return prefs;
  }

  listParentNotificationPreferencesUpdatedSince(
    since: Date,
    organizationId = 1
  ): ParentNotificationPreferences[] {
    return this.db
      .prepare(
        'SELECT * FROM parent_notification_preferences WHERE organization_id = ? AND updated_at >= ? ORDER BY updated_at ASC'
      )
      .all(organizationId, since.toISOString()) as ParentNotificationPreferences[];
  }

  // Permissions

  listPermissions(): Permission[] {
    return this.db
      .prepare('SELECT * FROM permissions ORDER BY module ASC, action ASC')
      .all() as Permission[];
  }

  insertPermission(permission: Permission): void {
    this.db
      .prepare(`
        INSERT INTO permissions (id, module, action, description)
        VALUES (@id, @module, @action, @description)
      `)
      .run(permission);
  }

  countPermissions(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM permissions').get() as {
      count: number;
    };
    return row.count;
  }

  listRolePermissions(role?: string): RolePermission[] {
    if (role) {
      return this.db
        .prepare('SELECT * FROM role_permissions WHERE role = ? ORDER BY id ASC')
        .all(role) as RolePermission[];
    }
    return this.db
      .prepare('SELECT * FROM role_permissions ORDER BY role ASC, id ASC')
      .all() as RolePermission[];
  }

  insertRolePermission(rp: RolePermission): void {
    this.db
      .prepare(`
        INSERT INTO role_permissions (id, role, permission_id, scope)
        VALUES (@id, @role, @permission_id, @scope)
      `)
      .run(rp);
  }

  countRolePermissions(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM role_permissions').get() as {
      count: number;
    };
    return row.count;
  }

  seedPermissionsAndRoles(permissions: Permission[], rolePermissions: RolePermission[]): void {
    const seed = this.db.transaction(() => {
      const insertPermission = this.db.prepare(`
        INSERT INTO permissions (id, module, action, description)
        VALUES (@id, @module, @action, @description)
      `);
      const insertRolePermission = this.db.prepare(`
        INSERT INTO role_permissions (id, role, permission_id, scope)
        VALUES (@id, @role, @permission_id, @scope)
      `);

      for (const permission of permissions) {
        insertPermission.run(permission);
      }
      for (const rolePermission of rolePermissions) {
        insertRolePermission.run(rolePermission);
      }
    });

    seed();
  }

  // Teacher assignments

  assignTeacherToGroup(assignment: TeacherGroupAssignment): void {
    this.db
      .prepare(`
        INSERT OR IGNORE INTO teacher_group_assignments (id, organization_id, user_id, group_id)
        VALUES (@id, @organization_id, @user_id, @group_id)
      `)
      .run({
        ...assignment,
        organization_id: assignment.organization_id ?? 1,
      });
  }

  getTeacherGroupIds(userId: number): number[] {
    const rows = this.db
      .prepare('SELECT group_id FROM teacher_group_assignments WHERE user_id = ?')
      .all(userId) as { group_id: number }[];
    return rows.map((row) => row.group_id);
  }

  // Groups

  listGroups(): StudentGroup[] {
    return this.db
      .prepare('SELECT * FROM student_groups ORDER BY name ASC')
      .all() as StudentGroup[];
  }

  listGroupsCreatedSince(since: Date): StudentGroup[] {
    return this.db
      .prepare('SELECT * FROM student_groups WHERE created_at > ? ORDER BY created_at ASC')
      .all(since.toISOString()) as StudentGroup[];
  }

  findGroupByClientId(clientId: number): StudentGroup | undefined {
    return this.db
      .prepare('SELECT * FROM student_groups WHERE client_id = ?')
      .get(clientId) as StudentGroup | undefined;
  }

  insertGroup(group: StudentGroup): void {
    this.db
      .prepare(`
        INSERT INTO student_groups (
          id, organization_id, name, description, is_default, client_id, created_at
        ) VALUES (
          @id, @organization_id, @name, @description, @is_default, @client_id, @created_at
        )
      `)
      .run({
        ...group,
        organization_id: group.organization_id ?? 1,
      });
  }

  updateGroup(group: StudentGroup): boolean {
    const result = this.db
      .prepare(`
        UPDATE student_groups SET
          name = @name,
          description = @description,
          is_default = @is_default,
          client_id = @client_id
        WHERE id = @id
      `)
      .run(group);
    return result.changes > 0;
  }

  deleteGroup(id: number): boolean {
    const group = this.findGroupById(id);
    if (!group || group.is_default) {
      return false;
    }
    const result = this.db.prepare('DELETE FROM student_groups WHERE id = ?').run(id);
    return result.changes > 0;
  }

  findGroupById(id: number): StudentGroup | undefined {
    return this.db
      .prepare('SELECT * FROM student_groups WHERE id = ?')
      .get(id) as StudentGroup | undefined;
  }

  countGroups(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM student_groups').get() as {
      count: number;
    };
    return row.count;
  }

  // Group-student assignments

  assignStudentToGroup(record: GroupStudent): void {
    this.db
      .prepare(`
        INSERT OR IGNORE INTO group_students (
          id, organization_id, group_id, student_id, assigned_at, assigned_by
        ) VALUES (
          @id, @organization_id, @group_id, @student_id, @assigned_at, @assigned_by
        )
      `)
      .run({
        ...record,
        organization_id: record.organization_id ?? 1,
      });
  }

  unassignStudentFromGroup(groupId: number, studentId: number): boolean {
    const result = this.db
      .prepare('DELETE FROM group_students WHERE group_id = ? AND student_id = ?')
      .run(groupId, studentId);
    return result.changes > 0;
  }

  listGroupStudents(groupId: number): GroupStudent[] {
    return this.db
      .prepare('SELECT * FROM group_students WHERE group_id = ? ORDER BY assigned_at ASC')
      .all(groupId) as GroupStudent[];
  }

  listStudentGroups(studentId: number): GroupStudent[] {
    return this.db
      .prepare('SELECT * FROM group_students WHERE student_id = ? ORDER BY assigned_at ASC')
      .all(studentId) as GroupStudent[];
  }

  // Students

  listStudents(groupId?: number, organizationId?: number): Student[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (groupId !== undefined) {
      conditions.push('group_id = ?');
      params.push(groupId);
    }
    if (organizationId !== undefined) {
      conditions.push('organization_id = ?');
      params.push(organizationId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return this.db
      .prepare(`SELECT * FROM students ${where} ORDER BY created_at DESC`)
      .all(...params) as Student[];
  }

  listStudentsUpdatedSince(since: Date): Student[] {
    return this.db
      .prepare('SELECT * FROM students WHERE updated_at > ? ORDER BY updated_at ASC')
      .all(since.toISOString()) as Student[];
  }

  listStudentsByIds(ids: number[]): Student[] {
    if (ids.length === 0) {
      return [];
    }
    const placeholders = ids.map(() => '?').join(', ');
    return this.db
      .prepare(`SELECT * FROM students WHERE id IN (${placeholders})`)
      .all(...ids) as Student[];
  }

  getStudentById(id: number): Student | undefined {
    return this.db.prepare('SELECT * FROM students WHERE id = ?').get(id) as Student | undefined;
  }

  getStudentByClientId(clientId: number): Student | undefined {
    return this.db
      .prepare('SELECT * FROM students WHERE client_id = ?')
      .get(clientId) as Student | undefined;
  }

  insertStudent(student: Student): void {
    this.db
      .prepare(`
        INSERT INTO students (
          id, organization_id, name, class, roll_no, mobile, address, admission_no, parent_name, parent_mobile,
          academic_year, section, status, fee_status, group_id, custom_data, client_id,
          created_at, updated_at
        ) VALUES (
          @id, @organization_id, @name, @class, @roll_no, @mobile, @address, @admission_no, @parent_name, @parent_mobile,
          @academic_year, @section, @status, @fee_status, @group_id, @custom_data, @client_id,
          @created_at, @updated_at
        )
      `)
      .run({
        ...student,
        organization_id: student.organization_id ?? 1,
      });
  }

  updateStudentRecord(student: Student): boolean {
    const result = this.db
      .prepare(`
        UPDATE students SET
          name = @name,
          class = @class,
          roll_no = @roll_no,
          mobile = @mobile,
          address = @address,
          admission_no = @admission_no,
          parent_name = @parent_name,
          parent_mobile = @parent_mobile,
          academic_year = @academic_year,
          section = @section,
          status = @status,
          fee_status = @fee_status,
          group_id = @group_id,
          custom_data = @custom_data,
          updated_at = @updated_at
        WHERE id = @id
      `)
      .run(student);
    return result.changes > 0;
  }

  deleteStudent(id: number): boolean {
    const result = this.db.prepare('DELETE FROM students WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // Activities

  insertActivity(activity: StudentActivity): void {
    this.db
      .prepare(`
        INSERT INTO student_activities (id, student_id, action, message, action_date, logged_date, user_id)
        VALUES (@id, @student_id, @action, @message, @action_date, @logged_date, @user_id)
      `)
      .run(activity);
  }

  listActivities(studentId?: number, limit = 20): StudentActivity[] {
    if (studentId) {
      return this.db
        .prepare(`
          SELECT * FROM student_activities
          WHERE student_id = ?
          ORDER BY id DESC
          LIMIT ?
        `)
        .all(studentId, limit) as StudentActivity[];
    }
    return this.db
      .prepare('SELECT * FROM student_activities ORDER BY id DESC LIMIT ?')
      .all(limit) as StudentActivity[];
  }

  deleteActivitiesByStudentId(studentId: number): void {
    this.db.prepare('DELETE FROM student_activities WHERE student_id = ?').run(studentId);
  }

  // Events

  listEvents(filters: EventFilters = {}): Event[] {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let join = '';

    if (filters.organizationId !== undefined) {
      conditions.push('e.organization_id = ?');
      params.push(filters.organizationId);
    }
    if (filters.groupId !== undefined) {
      conditions.push('e.group_id = ?');
      params.push(filters.groupId);
    }
    if (filters.status !== undefined) {
      conditions.push('e.status = ?');
      params.push(filters.status);
    }
    if (filters.fromDate !== undefined) {
      conditions.push('e.start_date >= ?');
      params.push(filters.fromDate);
    }
    if (filters.toDate !== undefined) {
      conditions.push('e.start_date <= ?');
      params.push(filters.toDate);
    }
    if (filters.studentId !== undefined) {
      join = 'INNER JOIN event_participants ep ON ep.event_id = e.id';
      conditions.push('ep.student_id = ?');
      params.push(filters.studentId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return this.db
      .prepare(`
        SELECT DISTINCT e.* FROM events e
        ${join}
        ${where}
        ORDER BY e.start_date ASC, e.id ASC
      `)
      .all(...params) as Event[];
  }

  getEventById(id: number): Event | undefined {
    return this.db.prepare('SELECT * FROM events WHERE id = ?').get(id) as Event | undefined;
  }

  getEventByClientId(clientId: number): Event | undefined {
    return this.db.prepare('SELECT * FROM events WHERE client_id = ?').get(clientId) as Event | undefined;
  }

  listEventsUpdatedSince(since: Date, organizationId = 1): Event[] {
    return this.db
      .prepare(
        'SELECT * FROM events WHERE organization_id = ? AND updated_at >= ? ORDER BY updated_at ASC'
      )
      .all(organizationId, since.toISOString()) as Event[];
  }

  insertEvent(event: Event): void {
    this.db
      .prepare(`
        INSERT INTO events (
          id, organization_id, title, description, event_type, start_date, end_date, location,
          group_id, created_by, status, client_id, created_at, updated_at
        ) VALUES (
          @id, @organization_id, @title, @description, @event_type, @start_date, @end_date, @location,
          @group_id, @created_by, @status, @client_id, @created_at, @updated_at
        )
      `)
      .run({
        ...event,
        organization_id: event.organization_id ?? 1,
      });
  }

  updateEvent(event: Event): boolean {
    const result = this.db
      .prepare(`
        UPDATE events SET
          title = @title,
          description = @description,
          event_type = @event_type,
          start_date = @start_date,
          end_date = @end_date,
          location = @location,
          group_id = @group_id,
          created_by = @created_by,
          status = @status,
          client_id = @client_id,
          updated_at = @updated_at
        WHERE id = @id
      `)
      .run(event);
    return result.changes > 0;
  }

  deleteEvent(id: number): boolean {
    const result = this.db.prepare('DELETE FROM events WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // Event participants

  addEventParticipant(participant: EventParticipant): void {
    this.db
      .prepare(`
        INSERT OR IGNORE INTO event_participants (id, event_id, student_id, registration_status)
        VALUES (@id, @event_id, @student_id, @registration_status)
      `)
      .run(participant);
  }

  removeEventParticipant(eventId: number, studentId: number): boolean {
    const result = this.db
      .prepare('DELETE FROM event_participants WHERE event_id = ? AND student_id = ?')
      .run(eventId, studentId);
    return result.changes > 0;
  }

  listEventParticipants(eventId: number): EventParticipant[] {
    return this.db
      .prepare('SELECT * FROM event_participants WHERE event_id = ? ORDER BY id ASC')
      .all(eventId) as EventParticipant[];
  }

  // Attendance

  listAttendance(filters: AttendanceFilters = {}): AttendanceRecord[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.organizationId !== undefined) {
      conditions.push('organization_id = ?');
      params.push(filters.organizationId);
    }
    if (filters.date !== undefined) {
      conditions.push('attendance_date = ?');
      params.push(filters.date);
    }
    if (filters.groupId !== undefined) {
      conditions.push('group_id = ?');
      params.push(filters.groupId);
    }
    if (filters.studentId !== undefined) {
      conditions.push('student_id = ?');
      params.push(filters.studentId);
    }
    if (filters.eventId !== undefined) {
      conditions.push('event_id = ?');
      params.push(filters.eventId);
    }
    if (filters.contextType !== undefined) {
      conditions.push('context_type = ?');
      params.push(filters.contextType);
    }
    if (filters.periodNumber !== undefined) {
      conditions.push('period_number = ?');
      params.push(filters.periodNumber);
    }
    if (filters.fromDate !== undefined) {
      conditions.push('attendance_date >= ?');
      params.push(filters.fromDate);
    }
    if (filters.toDate !== undefined) {
      conditions.push('attendance_date <= ?');
      params.push(filters.toDate);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return this.db
      .prepare(`
        SELECT * FROM attendance_records
        ${where}
        ORDER BY attendance_date DESC, student_id ASC, id ASC
      `)
      .all(...params) as AttendanceRecord[];
  }

  getAttendanceById(id: number): AttendanceRecord | undefined {
    return this.db
      .prepare('SELECT * FROM attendance_records WHERE id = ?')
      .get(id) as AttendanceRecord | undefined;
  }

  getAttendanceByClientId(clientId: number): AttendanceRecord | undefined {
    return this.db
      .prepare('SELECT * FROM attendance_records WHERE client_id = ?')
      .get(clientId) as AttendanceRecord | undefined;
  }

  listAttendanceUpdatedSince(since: Date, organizationId = 1): AttendanceRecord[] {
    return this.db
      .prepare(
        'SELECT * FROM attendance_records WHERE organization_id = ? AND updated_at >= ? ORDER BY updated_at ASC'
      )
      .all(organizationId, since.toISOString()) as AttendanceRecord[];
  }

  insertAttendance(record: AttendanceRecord): void {
    this.db
      .prepare(`
        INSERT INTO attendance_records (
          id, organization_id, student_id, group_id, event_id, attendance_date, context_type,
          period_number, status, remarks, marked_by, client_id, created_at, updated_at
        ) VALUES (
          @id, @organization_id, @student_id, @group_id, @event_id, @attendance_date, @context_type,
          @period_number, @status, @remarks, @marked_by, @client_id, @created_at, @updated_at
        )
      `)
      .run({
        ...record,
        organization_id: record.organization_id ?? 1,
      });
  }

  updateAttendance(record: AttendanceRecord): boolean {
    const result = this.db
      .prepare(`
        UPDATE attendance_records SET
          organization_id = @organization_id,
          student_id = @student_id,
          group_id = @group_id,
          event_id = @event_id,
          attendance_date = @attendance_date,
          context_type = @context_type,
          period_number = @period_number,
          status = @status,
          remarks = @remarks,
          marked_by = @marked_by,
          client_id = @client_id,
          updated_at = @updated_at
        WHERE id = @id
      `)
      .run(record);
    return result.changes > 0;
  }

  upsertAttendance(record: AttendanceRecord): AttendanceRecord {
    const existing = this.findAttendanceByUniqueKey(record);
    if (existing) {
      const updated: AttendanceRecord = {
        ...record,
        id: existing.id,
        created_at: existing.created_at,
      };
      this.updateAttendance(updated);
      return updated;
    }

    this.insertAttendance(record);
    return record;
  }

  deleteAttendance(id: number): boolean {
    const result = this.db.prepare('DELETE FROM attendance_records WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // Custom field definitions

  listCustomFieldDefinitions(filters: CustomFieldFilters = {}): CustomFieldDefinition[] {
    const orgId = filters.organizationId ?? 1;
    let sql = 'SELECT * FROM custom_field_definitions WHERE organization_id = ?';
    const params: unknown[] = [orgId];

    if (filters.entityType) {
      sql += ' AND entity_type = ?';
      params.push(filters.entityType);
    }
    if (!filters.includeInactive) {
      sql += ' AND is_active = 1';
    }
    sql += ' ORDER BY display_order ASC, id ASC';

    return this.db.prepare(sql).all(...params) as CustomFieldDefinition[];
  }

  listCustomFieldDefinitionsUpdatedSince(since: Date, organizationId = 1): CustomFieldDefinition[] {
    return this.db
      .prepare(`
        SELECT * FROM custom_field_definitions
        WHERE organization_id = ? AND updated_at > ?
        ORDER BY updated_at ASC
      `)
      .all(organizationId, since.toISOString()) as CustomFieldDefinition[];
  }

  getCustomFieldDefinitionById(id: number): CustomFieldDefinition | undefined {
    return this.db
      .prepare('SELECT * FROM custom_field_definitions WHERE id = ?')
      .get(id) as CustomFieldDefinition | undefined;
  }

  getCustomFieldDefinitionByName(
    organizationId: number,
    entityType: string,
    fieldName: string
  ): CustomFieldDefinition | undefined {
    return this.db
      .prepare(`
        SELECT * FROM custom_field_definitions
        WHERE organization_id = ? AND entity_type = ? AND field_name = ?
      `)
      .get(organizationId, entityType, fieldName) as CustomFieldDefinition | undefined;
  }

  insertCustomFieldDefinition(definition: CustomFieldDefinition): void {
    this.db
      .prepare(`
        INSERT INTO custom_field_definitions (
          id, organization_id, entity_type, field_name, field_label, field_type,
          is_required, default_value, validation_rules_json, display_order, is_active,
          client_id, created_at, updated_at
        ) VALUES (
          @id, @organization_id, @entity_type, @field_name, @field_label, @field_type,
          @is_required, @default_value, @validation_rules_json, @display_order, @is_active,
          @client_id, @created_at, @updated_at
        )
      `)
      .run(definition);
  }

  updateCustomFieldDefinition(definition: CustomFieldDefinition): boolean {
    const result = this.db
      .prepare(`
        UPDATE custom_field_definitions SET
          field_label = @field_label,
          field_type = @field_type,
          is_required = @is_required,
          default_value = @default_value,
          validation_rules_json = @validation_rules_json,
          display_order = @display_order,
          is_active = @is_active,
          updated_at = @updated_at
        WHERE id = @id
      `)
      .run(definition);
    return result.changes > 0;
  }

  deleteCustomFieldDefinition(id: number): boolean {
    const result = this.db.prepare('DELETE FROM custom_field_definitions WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // Custom field values

  listCustomFieldValues(entityType: string, entityId: number): CustomFieldValue[] {
    return this.db
      .prepare(`
        SELECT * FROM custom_field_values
        WHERE entity_type = ? AND entity_id = ?
        ORDER BY id ASC
      `)
      .all(entityType, entityId) as CustomFieldValue[];
  }

  listCustomFieldValuesUpdatedSince(since: Date, organizationId = 1): CustomFieldValue[] {
    return this.db
      .prepare(`
        SELECT * FROM custom_field_values
        WHERE organization_id = ? AND updated_at > ?
        ORDER BY updated_at ASC
      `)
      .all(organizationId, since.toISOString()) as CustomFieldValue[];
  }

  upsertCustomFieldValue(value: CustomFieldValue): CustomFieldValue {
    const existing = this.db
      .prepare(`
        SELECT * FROM custom_field_values
        WHERE field_definition_id = ? AND entity_type = ? AND entity_id = ?
      `)
      .get(value.field_definition_id, value.entity_type, value.entity_id) as
      | CustomFieldValue
      | undefined;

    if (existing) {
      const updated: CustomFieldValue = {
        ...value,
        id: existing.id,
      };
      this.db
        .prepare(`
          UPDATE custom_field_values SET
            value_text = @value_text,
            client_id = @client_id,
            updated_at = @updated_at
          WHERE id = @id
        `)
        .run(updated);
      return updated;
    }

    this.db
      .prepare(`
        INSERT INTO custom_field_values (
          id, organization_id, field_definition_id, entity_type, entity_id,
          value_text, client_id, updated_at
        ) VALUES (
          @id, @organization_id, @field_definition_id, @entity_type, @entity_id,
          @value_text, @client_id, @updated_at
        )
      `)
      .run(value);
    return value;
  }

  deleteCustomFieldValuesForEntity(entityType: string, entityId: number): void {
    this.db
      .prepare('DELETE FROM custom_field_values WHERE entity_type = ? AND entity_id = ?')
      .run(entityType, entityId);
  }

  // Audit logs

  insertAuditLog(log: AuditLog): void {
    this.db
      .prepare(`
        INSERT INTO audit_logs (id, organization_id, entity_type, entity_id, action, changes_json, user_id, created_at)
        VALUES (@id, @organization_id, @entity_type, @entity_id, @action, @changes_json, @user_id, @created_at)
      `)
      .run(log);
  }

  listAuditLogs(entityType?: string, entityId?: number, limit = 50): AuditLog[] {
    if (entityType && entityId !== undefined) {
      return this.db
        .prepare(`
          SELECT * FROM audit_logs
          WHERE entity_type = ? AND entity_id = ?
          ORDER BY id DESC LIMIT ?
        `)
        .all(entityType, entityId, limit) as AuditLog[];
    }
    return this.db
      .prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?')
      .all(limit) as AuditLog[];
  }

  // Voice entries

  listVoiceEntries(filters: VoiceEntryFilters = {}): VoiceEntry[] {
    const { sql, params } = this.buildVoiceEntryQuery(filters, false);
    return this.db.prepare(`${sql} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(
      ...params,
      filters.limit ?? 100,
      filters.offset ?? 0
    ) as VoiceEntry[];
  }

  countVoiceEntries(filters: VoiceEntryFilters = {}): number {
    const { sql, params } = this.buildVoiceEntryQuery(filters, true);
    const row = this.db.prepare(sql).get(...params) as { count: number };
    return row.count;
  }

  listVoiceEntriesUpdatedSince(since: Date, organizationId = 1): VoiceEntry[] {
    return this.db
      .prepare(`
        SELECT * FROM voice_entries
        WHERE organization_id = ? AND modified_at > ?
        ORDER BY modified_at ASC
      `)
      .all(organizationId, since.toISOString()) as VoiceEntry[];
  }

  getVoiceEntryById(id: number): VoiceEntry | undefined {
    return this.db.prepare('SELECT * FROM voice_entries WHERE id = ?').get(id) as
      | VoiceEntry
      | undefined;
  }

  getVoiceEntryByClientId(clientId: number): VoiceEntry | undefined {
    return this.db
      .prepare('SELECT * FROM voice_entries WHERE client_id = ?')
      .get(clientId) as VoiceEntry | undefined;
  }

  insertVoiceEntry(entry: VoiceEntry): void {
    this.db
      .prepare(`
        INSERT INTO voice_entries (
          id, organization_id, student_id, entity_type, entity_id, module_code,
          transcript, processed_json, audio_url, speech_engine, status, created_by,
          client_id, created_at, modified_at
        ) VALUES (
          @id, @organization_id, @student_id, @entity_type, @entity_id, @module_code,
          @transcript, @processed_json, @audio_url, @speech_engine, @status, @created_by,
          @client_id, @created_at, @modified_at
        )
      `)
      .run(entry);
  }

  updateVoiceEntry(entry: VoiceEntry): boolean {
    const result = this.db
      .prepare(`
        UPDATE voice_entries SET
          student_id = @student_id,
          entity_type = @entity_type,
          entity_id = @entity_id,
          module_code = @module_code,
          transcript = @transcript,
          processed_json = @processed_json,
          audio_url = @audio_url,
          speech_engine = @speech_engine,
          status = @status,
          modified_at = @modified_at
        WHERE id = @id
      `)
      .run(entry);
    return result.changes > 0;
  }

  deleteVoiceEntry(id: number): boolean {
    const result = this.db.prepare('DELETE FROM voice_entries WHERE id = ?').run(id);
    return result.changes > 0;
  }

  listVoiceEntryEdits(voiceEntryId: number): VoiceEntryEdit[] {
    return this.db
      .prepare('SELECT * FROM voice_entry_edits WHERE voice_entry_id = ? ORDER BY id ASC')
      .all(voiceEntryId) as VoiceEntryEdit[];
  }

  insertVoiceEntryEdit(edit: VoiceEntryEdit): void {
    this.db
      .prepare(`
        INSERT INTO voice_entry_edits (id, voice_entry_id, field_name, old_value, new_value, edited_by, edited_at)
        VALUES (@id, @voice_entry_id, @field_name, @old_value, @new_value, @edited_by, @edited_at)
      `)
      .run(edit);
  }

  private buildVoiceEntryQuery(
    filters: VoiceEntryFilters,
    countOnly: boolean
  ): { sql: string; params: unknown[] } {
    const orgId = filters.organizationId ?? 1;
    const params: unknown[] = [orgId];
    let sql = countOnly
      ? 'SELECT COUNT(*) AS count FROM voice_entries WHERE organization_id = ?'
      : 'SELECT * FROM voice_entries WHERE organization_id = ?';

    if (filters.studentId !== undefined) {
      sql += ' AND student_id = ?';
      params.push(filters.studentId);
    }
    if (filters.moduleCode) {
      sql += ' AND module_code = ?';
      params.push(filters.moduleCode);
    }
    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.speechEngine) {
      sql += ' AND speech_engine = ?';
      params.push(filters.speechEngine);
    }
    if (filters.createdBy !== undefined) {
      sql += ' AND created_by = ?';
      params.push(filters.createdBy);
    }
    if (filters.fromDate) {
      sql += ' AND created_at >= ?';
      params.push(filters.fromDate);
    }
    if (filters.toDate) {
      sql += ' AND created_at <= ?';
      params.push(filters.toDate);
    }
    if (filters.search?.trim()) {
      sql += ' AND (transcript LIKE ? OR processed_json LIKE ?)';
      const term = `%${filters.search.trim()}%`;
      params.push(term, term);
    }

    return { sql, params };
  }

  // Certificate templates

  listCertificateTemplates(organizationId = 1, includeInactive = false): CertificateTemplate[] {
    let sql = 'SELECT * FROM certificate_templates WHERE organization_id = ?';
    if (!includeInactive) {
      sql += ' AND is_active = 1';
    }
    sql += ' ORDER BY name ASC';
    return this.db.prepare(sql).all(organizationId) as CertificateTemplate[];
  }

  listCertificateTemplatesUpdatedSince(since: Date, organizationId = 1): CertificateTemplate[] {
    return this.db
      .prepare(`
        SELECT * FROM certificate_templates
        WHERE organization_id = ? AND updated_at > ?
        ORDER BY updated_at ASC
      `)
      .all(organizationId, since.toISOString()) as CertificateTemplate[];
  }

  getCertificateTemplateById(id: number): CertificateTemplate | undefined {
    return this.db.prepare('SELECT * FROM certificate_templates WHERE id = ?').get(id) as
      | CertificateTemplate
      | undefined;
  }

  getCertificateTemplateByClientId(clientId: number): CertificateTemplate | undefined {
    return this.db
      .prepare('SELECT * FROM certificate_templates WHERE client_id = ?')
      .get(clientId) as CertificateTemplate | undefined;
  }

  insertCertificateTemplate(template: CertificateTemplate): void {
    this.db
      .prepare(`
        INSERT INTO certificate_templates (
          id, organization_id, name, description, certificate_type, template_url,
          is_active, created_by, client_id, created_at, updated_at
        ) VALUES (
          @id, @organization_id, @name, @description, @certificate_type, @template_url,
          @is_active, @created_by, @client_id, @created_at, @updated_at
        )
      `)
      .run(template);
  }

  updateCertificateTemplate(template: CertificateTemplate): boolean {
    const result = this.db
      .prepare(`
        UPDATE certificate_templates SET
          name = @name, description = @description, certificate_type = @certificate_type,
          template_url = @template_url, is_active = @is_active, updated_at = @updated_at
        WHERE id = @id
      `)
      .run(template);
    return result.changes > 0;
  }

  // Certificates

  listCertificates(filters: CertificateFilters = {}): Certificate[] {
    const { sql, params } = this.buildCertificateQuery(filters, false);
    return this.db.prepare(`${sql} ORDER BY issue_date DESC LIMIT ? OFFSET ?`).all(
      ...params,
      filters.limit ?? 100,
      filters.offset ?? 0
    ) as Certificate[];
  }

  countCertificates(filters: CertificateFilters = {}): number {
    const { sql, params } = this.buildCertificateQuery(filters, true);
    const row = this.db.prepare(sql).get(...params) as { count: number };
    return row.count;
  }

  listCertificatesUpdatedSince(since: Date, organizationId = 1): Certificate[] {
    return this.db
      .prepare(`
        SELECT * FROM certificates
        WHERE organization_id = ? AND updated_at > ?
        ORDER BY updated_at ASC
      `)
      .all(organizationId, since.toISOString()) as Certificate[];
  }

  getCertificateById(id: number): Certificate | undefined {
    return this.db.prepare('SELECT * FROM certificates WHERE id = ?').get(id) as
      | Certificate
      | undefined;
  }

  getCertificateByClientId(clientId: number): Certificate | undefined {
    return this.db
      .prepare('SELECT * FROM certificates WHERE client_id = ?')
      .get(clientId) as Certificate | undefined;
  }

  getCertificateByVerificationCode(code: string): Certificate | undefined {
    return this.db
      .prepare('SELECT * FROM certificates WHERE verification_code = ?')
      .get(code) as Certificate | undefined;
  }

  getCertificateByNumber(organizationId: number, certificateNumber: string): Certificate | undefined {
    return this.db
      .prepare('SELECT * FROM certificates WHERE organization_id = ? AND certificate_number = ?')
      .get(organizationId, certificateNumber) as Certificate | undefined;
  }

  insertCertificate(certificate: Certificate): void {
    this.db
      .prepare(`
        INSERT INTO certificates (
          id, organization_id, student_id, template_id, certificate_number, certificate_type,
          title, description, certificate_name, award_type, issue_date, issued_by, attachment_url,
          verification_code, status, revoked_at, revoked_by, revoke_reason, created_by, client_id,
          created_at, updated_at
        ) VALUES (
          @id, @organization_id, @student_id, @template_id, @certificate_number, @certificate_type,
          @title, @description, @certificate_name, @award_type, @issue_date, @issued_by, @attachment_url,
          @verification_code, @status, @revoked_at, @revoked_by, @revoke_reason, @created_by, @client_id,
          @created_at, @updated_at
        )
      `)
      .run(certificate);
  }

  updateCertificate(certificate: Certificate): boolean {
    const result = this.db
      .prepare(`
        UPDATE certificates SET
          student_id = @student_id, template_id = @template_id, certificate_type = @certificate_type,
          title = @title, description = @description, certificate_name = @certificate_name,
          award_type = @award_type, issue_date = @issue_date, issued_by = @issued_by,
          attachment_url = @attachment_url, status = @status, revoked_at = @revoked_at,
          revoked_by = @revoked_by, revoke_reason = @revoke_reason, updated_at = @updated_at
        WHERE id = @id
      `)
      .run(certificate);
    return result.changes > 0;
  }

  // Awards

  listAwards(filters: AwardFilters = {}): Award[] {
    const { sql, params } = this.buildAwardQuery(filters, false);
    return this.db.prepare(`${sql} ORDER BY award_date DESC LIMIT ? OFFSET ?`).all(
      ...params,
      filters.limit ?? 100,
      filters.offset ?? 0
    ) as Award[];
  }

  countAwards(filters: AwardFilters = {}): number {
    const { sql, params } = this.buildAwardQuery(filters, true);
    const row = this.db.prepare(sql).get(...params) as { count: number };
    return row.count;
  }

  listAwardsUpdatedSince(since: Date, organizationId = 1): Award[] {
    return this.db
      .prepare(`
        SELECT * FROM awards
        WHERE organization_id = ? AND updated_at > ?
        ORDER BY updated_at ASC
      `)
      .all(organizationId, since.toISOString()) as Award[];
  }

  getAwardById(id: number): Award | undefined {
    return this.db.prepare('SELECT * FROM awards WHERE id = ?').get(id) as Award | undefined;
  }

  getAwardByClientId(clientId: number): Award | undefined {
    return this.db.prepare('SELECT * FROM awards WHERE client_id = ?').get(clientId) as
      | Award
      | undefined;
  }

  getAwardByVerificationCode(code: string): Award | undefined {
    return this.db.prepare('SELECT * FROM awards WHERE verification_code = ?').get(code) as
      | Award
      | undefined;
  }

  insertAward(award: Award): void {
    this.db
      .prepare(`
        INSERT INTO awards (
          id, organization_id, student_id, category, title, description, award_date,
          issued_by, attachment_url, certificate_id, status, recommended_by, verification_code,
          created_by, client_id, created_at, updated_at
        ) VALUES (
          @id, @organization_id, @student_id, @category, @title, @description, @award_date,
          @issued_by, @attachment_url, @certificate_id, @status, @recommended_by, @verification_code,
          @created_by, @client_id, @created_at, @updated_at
        )
      `)
      .run(award);
  }

  updateAward(award: Award): boolean {
    const result = this.db
      .prepare(`
        UPDATE awards SET
          student_id = @student_id, category = @category, title = @title, description = @description,
          award_date = @award_date, issued_by = @issued_by, attachment_url = @attachment_url,
          certificate_id = @certificate_id, status = @status, recommended_by = @recommended_by,
          updated_at = @updated_at
        WHERE id = @id
      `)
      .run(award);
    return result.changes > 0;
  }

  private buildCertificateQuery(
    filters: CertificateFilters,
    countOnly: boolean
  ): { sql: string; params: unknown[] } {
    const orgId = filters.organizationId ?? 1;
    const params: unknown[] = [orgId];
    let sql = countOnly
      ? 'SELECT COUNT(*) AS count FROM certificates WHERE organization_id = ?'
      : 'SELECT * FROM certificates WHERE organization_id = ?';

    if (filters.studentId !== undefined) {
      sql += ' AND student_id = ?';
      params.push(filters.studentId);
    }
    if (filters.certificateType) {
      sql += ' AND certificate_type = ?';
      params.push(filters.certificateType);
    }
    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.templateId !== undefined) {
      sql += ' AND template_id = ?';
      params.push(filters.templateId);
    }
    if (filters.fromDate) {
      sql += ' AND issue_date >= ?';
      params.push(filters.fromDate);
    }
    if (filters.toDate) {
      sql += ' AND issue_date <= ?';
      params.push(filters.toDate);
    }
    if (filters.search?.trim()) {
      sql += ' AND (title LIKE ? OR certificate_number LIKE ? OR description LIKE ?)';
      const term = `%${filters.search.trim()}%`;
      params.push(term, term, term);
    }
    return { sql, params };
  }

  private buildAwardQuery(
    filters: AwardFilters,
    countOnly: boolean
  ): { sql: string; params: unknown[] } {
    const orgId = filters.organizationId ?? 1;
    const params: unknown[] = [orgId];
    let sql = countOnly
      ? 'SELECT COUNT(*) AS count FROM awards WHERE organization_id = ?'
      : 'SELECT * FROM awards WHERE organization_id = ?';

    if (filters.studentId !== undefined) {
      sql += ' AND student_id = ?';
      params.push(filters.studentId);
    }
    if (filters.category) {
      sql += ' AND category = ?';
      params.push(filters.category);
    }
    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.fromDate) {
      sql += ' AND award_date >= ?';
      params.push(filters.fromDate);
    }
    if (filters.toDate) {
      sql += ' AND award_date <= ?';
      params.push(filters.toDate);
    }
    if (filters.search?.trim()) {
      sql += ' AND (title LIKE ? OR description LIKE ?)';
      const term = `%${filters.search.trim()}%`;
      params.push(term, term);
    }
    return { sql, params };
  }

  // Lookups

  getAllLookups(): LookupMap {
    const rows = this.db
      .prepare('SELECT category, value, label FROM lookup_options ORDER BY category, sort_order, id')
      .all() as { category: LookupCategory; value: string; label: string }[];

    const lookups: LookupMap = {
      class: [],
      grade: [],
      section: [],
      status: [],
      feeStatus: [],
    };

    for (const row of rows) {
      lookups[row.category].push({ value: row.value, label: row.label });
    }
    return lookups;
  }

  getLookupCategory(category: string): LookupOption[] | null {
    if (!['class', 'grade', 'section', 'status', 'feeStatus'].includes(category)) {
      return null;
    }
    return this.db
      .prepare(`
        SELECT value, label FROM lookup_options
        WHERE category = ?
        ORDER BY sort_order, id
      `)
      .all(category) as LookupOption[];
  }

  seedLookups(defaults: LookupMap): void {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM lookup_options').get() as {
      count: number;
    };
    if (row.count > 0) {
      return;
    }

    const insert = this.db.prepare(`
      INSERT INTO lookup_options (category, value, label, sort_order)
      VALUES (@category, @value, @label, @sort_order)
    `);

    const seed = this.db.transaction(() => {
      for (const [category, options] of Object.entries(defaults)) {
        options.forEach((option, index) => {
          insert.run({
            category,
            value: option.value,
            label: option.label,
            sort_order: index,
          });
        });
      }
    });

    seed();
  }

  countLookups(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM lookup_options').get() as {
      count: number;
    };
    return row.count;
  }

  private findAttendanceByUniqueKey(
    record: Pick<
      AttendanceRecord,
      'student_id' | 'attendance_date' | 'context_type' | 'period_number' | 'event_id'
    >
  ): AttendanceRecord | undefined {
    return this.db
      .prepare(`
        SELECT * FROM attendance_records
        WHERE student_id = @student_id
          AND attendance_date = @attendance_date
          AND context_type = @context_type
          AND (
            (period_number IS NULL AND @period_number IS NULL)
            OR period_number = @period_number
          )
          AND (
            (event_id IS NULL AND @event_id IS NULL)
            OR event_id = @event_id
          )
      `)
      .get({
        student_id: record.student_id,
        attendance_date: record.attendance_date,
        context_type: record.context_type,
        period_number: record.period_number,
        event_id: record.event_id,
      }) as AttendanceRecord | undefined;
  }

  private toSqliteTable(table: IdTable): string {
    switch (table) {
      case 'users':
        return 'users';
      case 'studentGroups':
        return 'student_groups';
      case 'students':
        return 'students';
      case 'studentActivities':
        return 'student_activities';
      case 'organizations':
        return 'organizations';
      case 'permissions':
        return 'permissions';
      case 'rolePermissions':
        return 'role_permissions';
      case 'userStudentLinks':
        return 'user_student_links';
      case 'parents':
        return 'parents';
      case 'parentStudentMappings':
        return 'parent_student_mappings';
      case 'parentNotificationPreferences':
        return 'parent_notification_preferences';
      case 'groupStudents':
        return 'group_students';
      case 'teacherGroupAssignments':
        return 'teacher_group_assignments';
      case 'events':
        return 'events';
      case 'eventParticipants':
        return 'event_participants';
      case 'attendanceRecords':
        return 'attendance_records';
      case 'certificateTemplates':
        return 'certificate_templates';
      case 'certificates':
        return 'certificates';
      case 'awards':
        return 'awards';
      case 'voiceEntries':
        return 'voice_entries';
      case 'voiceEntryEdits':
        return 'voice_entry_edits';
      case 'customFieldDefinitions':
        return 'custom_field_definitions';
      case 'customFieldValues':
        return 'custom_field_values';
      case 'auditLogs':
        return 'audit_logs';
    }
  }
}

export function createSqliteRepository(): SqliteRepository {
  return new SqliteRepository(config.dbPath);
}
