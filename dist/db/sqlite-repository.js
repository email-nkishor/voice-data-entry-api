"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqliteRepository = void 0;
exports.createSqliteRepository = createSqliteRepository;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const config_1 = require("../config");
const migrate_json_1 = require("./migrate-json");
const migrations_1 = require("./migrations");
const schema_1 = require("./schema");
class SqliteRepository {
    driver = 'sqlite';
    db;
    constructor(filePath) {
        const dir = path_1.default.dirname(filePath);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        this.db = new better_sqlite3_1.default(filePath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
        this.db.exec(schema_1.SCHEMA_SQL);
        (0, migrations_1.runMigrations)(this.db);
        for (const jsonPath of (0, migrate_json_1.findLegacyJsonPaths)(filePath)) {
            (0, migrate_json_1.migrateJsonToSqlite)(this.db, jsonPath);
        }
    }
    nextId(table) {
        const sqliteTable = this.toSqliteTable(table);
        const row = this.db
            .prepare(`SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM ${sqliteTable}`)
            .get();
        return row.nextId;
    }
    // Organizations
    getOrganization(id = 1) {
        return this.db
            .prepare('SELECT * FROM organizations WHERE id = ?')
            .get(id);
    }
    insertOrganization(org) {
        this.db
            .prepare(`
        INSERT INTO organizations (id, name, code, settings_json, created_at, updated_at)
        VALUES (@id, @name, @code, @settings_json, @created_at, @updated_at)
      `)
            .run(org);
    }
    updateOrganization(org) {
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
    countOrganizations() {
        const row = this.db.prepare('SELECT COUNT(*) AS count FROM organizations').get();
        return row.count;
    }
    // Users
    findUserByEmail(email) {
        return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    }
    findUserById(id) {
        return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    }
    listUsers(organizationId) {
        if (organizationId !== undefined) {
            return this.db
                .prepare('SELECT * FROM users WHERE organization_id = ? ORDER BY name ASC')
                .all(organizationId);
        }
        return this.db.prepare('SELECT * FROM users ORDER BY name ASC').all();
    }
    insertUser(user) {
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
    updateUser(user) {
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
    deleteUser(id) {
        const result = this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
        return result.changes > 0;
    }
    countUsers() {
        const row = this.db.prepare('SELECT COUNT(*) AS count FROM users').get();
        return row.count;
    }
    // User-student links
    linkParentToStudent(link) {
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
    unlinkParentFromStudent(userId, studentId) {
        const result = this.db
            .prepare('DELETE FROM user_student_links WHERE user_id = ? AND student_id = ?')
            .run(userId, studentId);
        return result.changes > 0;
    }
    getLinkedStudents(userId) {
        return this.db
            .prepare('SELECT * FROM user_student_links WHERE user_id = ? ORDER BY is_primary DESC, id ASC')
            .all(userId);
    }
    listUserStudentLinksUpdatedSince(since, organizationId = 1) {
        return this.db
            .prepare('SELECT * FROM user_student_links WHERE organization_id = ? AND created_at >= ? ORDER BY created_at ASC')
            .all(organizationId, since.toISOString());
    }
    getLinkedStudentIds(userId) {
        const linkIds = this.db
            .prepare('SELECT student_id FROM user_student_links WHERE user_id = ?')
            .all(userId).map((row) => row.student_id);
        const parentIds = this.getStudentIdsForParentUser(userId);
        return [...new Set([...linkIds, ...parentIds])];
    }
    listParents(organizationId = 1) {
        return this.db
            .prepare('SELECT * FROM parents WHERE organization_id = ? ORDER BY last_name ASC, first_name ASC')
            .all(organizationId);
    }
    listParentsUpdatedSince(since, organizationId = 1) {
        return this.db
            .prepare('SELECT * FROM parents WHERE organization_id = ? AND updated_at >= ? ORDER BY updated_at ASC')
            .all(organizationId, since.toISOString());
    }
    getParentById(id) {
        return this.db.prepare('SELECT * FROM parents WHERE id = ?').get(id);
    }
    getParentByUserId(userId) {
        return this.db.prepare('SELECT * FROM parents WHERE user_id = ?').get(userId);
    }
    getParentByClientId(clientId) {
        return this.db.prepare('SELECT * FROM parents WHERE client_id = ?').get(clientId);
    }
    insertParent(parent) {
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
    updateParent(parent) {
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
    countParents() {
        const row = this.db.prepare('SELECT COUNT(*) AS count FROM parents').get();
        return row.count;
    }
    listParentMappings(parentId, studentId) {
        let sql = 'SELECT * FROM parent_student_mappings WHERE 1=1';
        const params = [];
        if (parentId != null) {
            sql += ' AND parent_id = ?';
            params.push(parentId);
        }
        if (studentId != null) {
            sql += ' AND student_id = ?';
            params.push(studentId);
        }
        sql += ' ORDER BY is_primary_contact DESC, id ASC';
        return this.db.prepare(sql).all(...params);
    }
    listParentMappingsUpdatedSince(since, organizationId = 1) {
        return this.db
            .prepare('SELECT * FROM parent_student_mappings WHERE organization_id = ? AND created_at >= ? ORDER BY created_at ASC')
            .all(organizationId, since.toISOString());
    }
    getParentMapping(parentId, studentId) {
        return this.db
            .prepare('SELECT * FROM parent_student_mappings WHERE parent_id = ? AND student_id = ?')
            .get(parentId, studentId);
    }
    insertParentMapping(mapping) {
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
    deleteParentMapping(parentId, studentId) {
        const result = this.db
            .prepare('DELETE FROM parent_student_mappings WHERE parent_id = ? AND student_id = ?')
            .run(parentId, studentId);
        return result.changes > 0;
    }
    getStudentIdsForParentUser(userId) {
        const parent = this.getParentByUserId(userId);
        if (!parent) {
            return [];
        }
        return this.listParentMappings(parent.id).map((m) => m.student_id);
    }
    getParentNotificationPreferences(parentId) {
        return this.db
            .prepare('SELECT * FROM parent_notification_preferences WHERE parent_id = ?')
            .get(parentId);
    }
    upsertParentNotificationPreferences(prefs) {
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
    listParentNotificationPreferencesUpdatedSince(since, organizationId = 1) {
        return this.db
            .prepare('SELECT * FROM parent_notification_preferences WHERE organization_id = ? AND updated_at >= ? ORDER BY updated_at ASC')
            .all(organizationId, since.toISOString());
    }
    // Permissions
    listPermissions() {
        return this.db
            .prepare('SELECT * FROM permissions ORDER BY module ASC, action ASC')
            .all();
    }
    insertPermission(permission) {
        this.db
            .prepare(`
        INSERT INTO permissions (id, module, action, description)
        VALUES (@id, @module, @action, @description)
      `)
            .run(permission);
    }
    countPermissions() {
        const row = this.db.prepare('SELECT COUNT(*) AS count FROM permissions').get();
        return row.count;
    }
    listRolePermissions(role) {
        if (role) {
            return this.db
                .prepare('SELECT * FROM role_permissions WHERE role = ? ORDER BY id ASC')
                .all(role);
        }
        return this.db
            .prepare('SELECT * FROM role_permissions ORDER BY role ASC, id ASC')
            .all();
    }
    insertRolePermission(rp) {
        this.db
            .prepare(`
        INSERT INTO role_permissions (id, role, permission_id, scope)
        VALUES (@id, @role, @permission_id, @scope)
      `)
            .run(rp);
    }
    countRolePermissions() {
        const row = this.db.prepare('SELECT COUNT(*) AS count FROM role_permissions').get();
        return row.count;
    }
    seedPermissionsAndRoles(permissions, rolePermissions) {
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
    assignTeacherToGroup(assignment) {
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
    getTeacherGroupIds(userId) {
        const rows = this.db
            .prepare('SELECT group_id FROM teacher_group_assignments WHERE user_id = ?')
            .all(userId);
        return rows.map((row) => row.group_id);
    }
    // Groups
    listGroups() {
        return this.db
            .prepare('SELECT * FROM student_groups ORDER BY name ASC')
            .all();
    }
    listGroupsCreatedSince(since) {
        return this.db
            .prepare('SELECT * FROM student_groups WHERE created_at > ? ORDER BY created_at ASC')
            .all(since.toISOString());
    }
    findGroupByClientId(clientId) {
        return this.db
            .prepare('SELECT * FROM student_groups WHERE client_id = ?')
            .get(clientId);
    }
    insertGroup(group) {
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
    updateGroup(group) {
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
    deleteGroup(id) {
        const group = this.findGroupById(id);
        if (!group || group.is_default) {
            return false;
        }
        const result = this.db.prepare('DELETE FROM student_groups WHERE id = ?').run(id);
        return result.changes > 0;
    }
    findGroupById(id) {
        return this.db
            .prepare('SELECT * FROM student_groups WHERE id = ?')
            .get(id);
    }
    countGroups() {
        const row = this.db.prepare('SELECT COUNT(*) AS count FROM student_groups').get();
        return row.count;
    }
    // Group-student assignments
    assignStudentToGroup(record) {
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
    unassignStudentFromGroup(groupId, studentId) {
        const result = this.db
            .prepare('DELETE FROM group_students WHERE group_id = ? AND student_id = ?')
            .run(groupId, studentId);
        return result.changes > 0;
    }
    listGroupStudents(groupId) {
        return this.db
            .prepare('SELECT * FROM group_students WHERE group_id = ? ORDER BY assigned_at ASC')
            .all(groupId);
    }
    listStudentGroups(studentId) {
        return this.db
            .prepare('SELECT * FROM group_students WHERE student_id = ? ORDER BY assigned_at ASC')
            .all(studentId);
    }
    // Students
    listStudents(groupId, organizationId) {
        const conditions = [];
        const params = [];
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
            .all(...params);
    }
    listStudentsUpdatedSince(since) {
        return this.db
            .prepare('SELECT * FROM students WHERE updated_at > ? ORDER BY updated_at ASC')
            .all(since.toISOString());
    }
    listStudentsByIds(ids) {
        if (ids.length === 0) {
            return [];
        }
        const placeholders = ids.map(() => '?').join(', ');
        return this.db
            .prepare(`SELECT * FROM students WHERE id IN (${placeholders})`)
            .all(...ids);
    }
    getStudentById(id) {
        return this.db.prepare('SELECT * FROM students WHERE id = ?').get(id);
    }
    getStudentByClientId(clientId) {
        return this.db
            .prepare('SELECT * FROM students WHERE client_id = ?')
            .get(clientId);
    }
    insertStudent(student) {
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
    updateStudentRecord(student) {
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
    deleteStudent(id) {
        const result = this.db.prepare('DELETE FROM students WHERE id = ?').run(id);
        return result.changes > 0;
    }
    // Activities
    insertActivity(activity) {
        this.db
            .prepare(`
        INSERT INTO student_activities (id, student_id, action, message, action_date, logged_date, user_id)
        VALUES (@id, @student_id, @action, @message, @action_date, @logged_date, @user_id)
      `)
            .run(activity);
    }
    listActivities(studentId, limit = 20) {
        if (studentId) {
            return this.db
                .prepare(`
          SELECT * FROM student_activities
          WHERE student_id = ?
          ORDER BY id DESC
          LIMIT ?
        `)
                .all(studentId, limit);
        }
        return this.db
            .prepare('SELECT * FROM student_activities ORDER BY id DESC LIMIT ?')
            .all(limit);
    }
    deleteActivitiesByStudentId(studentId) {
        this.db.prepare('DELETE FROM student_activities WHERE student_id = ?').run(studentId);
    }
    // Events
    listEvents(filters = {}) {
        const conditions = [];
        const params = [];
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
            .all(...params);
    }
    getEventById(id) {
        return this.db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    }
    getEventByClientId(clientId) {
        return this.db.prepare('SELECT * FROM events WHERE client_id = ?').get(clientId);
    }
    listEventsUpdatedSince(since, organizationId = 1) {
        return this.db
            .prepare('SELECT * FROM events WHERE organization_id = ? AND updated_at >= ? ORDER BY updated_at ASC')
            .all(organizationId, since.toISOString());
    }
    insertEvent(event) {
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
    updateEvent(event) {
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
    deleteEvent(id) {
        const result = this.db.prepare('DELETE FROM events WHERE id = ?').run(id);
        return result.changes > 0;
    }
    // Event participants
    addEventParticipant(participant) {
        this.db
            .prepare(`
        INSERT OR IGNORE INTO event_participants (id, event_id, student_id, registration_status)
        VALUES (@id, @event_id, @student_id, @registration_status)
      `)
            .run(participant);
    }
    removeEventParticipant(eventId, studentId) {
        const result = this.db
            .prepare('DELETE FROM event_participants WHERE event_id = ? AND student_id = ?')
            .run(eventId, studentId);
        return result.changes > 0;
    }
    listEventParticipants(eventId) {
        return this.db
            .prepare('SELECT * FROM event_participants WHERE event_id = ? ORDER BY id ASC')
            .all(eventId);
    }
    // Attendance
    listAttendance(filters = {}) {
        const conditions = [];
        const params = [];
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
            .all(...params);
    }
    getAttendanceById(id) {
        return this.db
            .prepare('SELECT * FROM attendance_records WHERE id = ?')
            .get(id);
    }
    getAttendanceByClientId(clientId) {
        return this.db
            .prepare('SELECT * FROM attendance_records WHERE client_id = ?')
            .get(clientId);
    }
    listAttendanceUpdatedSince(since, organizationId = 1) {
        return this.db
            .prepare('SELECT * FROM attendance_records WHERE organization_id = ? AND updated_at >= ? ORDER BY updated_at ASC')
            .all(organizationId, since.toISOString());
    }
    insertAttendance(record) {
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
    updateAttendance(record) {
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
    upsertAttendance(record) {
        const existing = this.findAttendanceByUniqueKey(record);
        if (existing) {
            const updated = {
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
    deleteAttendance(id) {
        const result = this.db.prepare('DELETE FROM attendance_records WHERE id = ?').run(id);
        return result.changes > 0;
    }
    // Custom field definitions
    listCustomFieldDefinitions(filters = {}) {
        const orgId = filters.organizationId ?? 1;
        let sql = 'SELECT * FROM custom_field_definitions WHERE organization_id = ?';
        const params = [orgId];
        if (filters.entityType) {
            sql += ' AND entity_type = ?';
            params.push(filters.entityType);
        }
        if (!filters.includeInactive) {
            sql += ' AND is_active = 1';
        }
        sql += ' ORDER BY display_order ASC, id ASC';
        return this.db.prepare(sql).all(...params);
    }
    listCustomFieldDefinitionsUpdatedSince(since, organizationId = 1) {
        return this.db
            .prepare(`
        SELECT * FROM custom_field_definitions
        WHERE organization_id = ? AND updated_at > ?
        ORDER BY updated_at ASC
      `)
            .all(organizationId, since.toISOString());
    }
    getCustomFieldDefinitionById(id) {
        return this.db
            .prepare('SELECT * FROM custom_field_definitions WHERE id = ?')
            .get(id);
    }
    getCustomFieldDefinitionByName(organizationId, entityType, fieldName) {
        return this.db
            .prepare(`
        SELECT * FROM custom_field_definitions
        WHERE organization_id = ? AND entity_type = ? AND field_name = ?
      `)
            .get(organizationId, entityType, fieldName);
    }
    insertCustomFieldDefinition(definition) {
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
    updateCustomFieldDefinition(definition) {
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
    deleteCustomFieldDefinition(id) {
        const result = this.db.prepare('DELETE FROM custom_field_definitions WHERE id = ?').run(id);
        return result.changes > 0;
    }
    // Custom field values
    listCustomFieldValues(entityType, entityId) {
        return this.db
            .prepare(`
        SELECT * FROM custom_field_values
        WHERE entity_type = ? AND entity_id = ?
        ORDER BY id ASC
      `)
            .all(entityType, entityId);
    }
    listCustomFieldValuesUpdatedSince(since, organizationId = 1) {
        return this.db
            .prepare(`
        SELECT * FROM custom_field_values
        WHERE organization_id = ? AND updated_at > ?
        ORDER BY updated_at ASC
      `)
            .all(organizationId, since.toISOString());
    }
    upsertCustomFieldValue(value) {
        const existing = this.db
            .prepare(`
        SELECT * FROM custom_field_values
        WHERE field_definition_id = ? AND entity_type = ? AND entity_id = ?
      `)
            .get(value.field_definition_id, value.entity_type, value.entity_id);
        if (existing) {
            const updated = {
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
    deleteCustomFieldValuesForEntity(entityType, entityId) {
        this.db
            .prepare('DELETE FROM custom_field_values WHERE entity_type = ? AND entity_id = ?')
            .run(entityType, entityId);
    }
    // Audit logs
    insertAuditLog(log) {
        this.db
            .prepare(`
        INSERT INTO audit_logs (id, organization_id, entity_type, entity_id, action, changes_json, user_id, created_at)
        VALUES (@id, @organization_id, @entity_type, @entity_id, @action, @changes_json, @user_id, @created_at)
      `)
            .run(log);
    }
    listAuditLogs(entityType, entityId, limit = 50) {
        if (entityType && entityId !== undefined) {
            return this.db
                .prepare(`
          SELECT * FROM audit_logs
          WHERE entity_type = ? AND entity_id = ?
          ORDER BY id DESC LIMIT ?
        `)
                .all(entityType, entityId, limit);
        }
        return this.db
            .prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?')
            .all(limit);
    }
    // Voice entries
    listVoiceEntries(filters = {}) {
        const { sql, params } = this.buildVoiceEntryQuery(filters, false);
        return this.db.prepare(`${sql} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, filters.limit ?? 100, filters.offset ?? 0);
    }
    countVoiceEntries(filters = {}) {
        const { sql, params } = this.buildVoiceEntryQuery(filters, true);
        const row = this.db.prepare(sql).get(...params);
        return row.count;
    }
    listVoiceEntriesUpdatedSince(since, organizationId = 1) {
        return this.db
            .prepare(`
        SELECT * FROM voice_entries
        WHERE organization_id = ? AND modified_at > ?
        ORDER BY modified_at ASC
      `)
            .all(organizationId, since.toISOString());
    }
    getVoiceEntryById(id) {
        return this.db.prepare('SELECT * FROM voice_entries WHERE id = ?').get(id);
    }
    getVoiceEntryByClientId(clientId) {
        return this.db
            .prepare('SELECT * FROM voice_entries WHERE client_id = ?')
            .get(clientId);
    }
    insertVoiceEntry(entry) {
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
    updateVoiceEntry(entry) {
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
    deleteVoiceEntry(id) {
        const result = this.db.prepare('DELETE FROM voice_entries WHERE id = ?').run(id);
        return result.changes > 0;
    }
    listVoiceEntryEdits(voiceEntryId) {
        return this.db
            .prepare('SELECT * FROM voice_entry_edits WHERE voice_entry_id = ? ORDER BY id ASC')
            .all(voiceEntryId);
    }
    insertVoiceEntryEdit(edit) {
        this.db
            .prepare(`
        INSERT INTO voice_entry_edits (id, voice_entry_id, field_name, old_value, new_value, edited_by, edited_at)
        VALUES (@id, @voice_entry_id, @field_name, @old_value, @new_value, @edited_by, @edited_at)
      `)
            .run(edit);
    }
    buildVoiceEntryQuery(filters, countOnly) {
        const orgId = filters.organizationId ?? 1;
        const params = [orgId];
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
    listCertificateTemplates(organizationId = 1, includeInactive = false) {
        let sql = 'SELECT * FROM certificate_templates WHERE organization_id = ?';
        if (!includeInactive) {
            sql += ' AND is_active = 1';
        }
        sql += ' ORDER BY name ASC';
        return this.db.prepare(sql).all(organizationId);
    }
    listCertificateTemplatesUpdatedSince(since, organizationId = 1) {
        return this.db
            .prepare(`
        SELECT * FROM certificate_templates
        WHERE organization_id = ? AND updated_at > ?
        ORDER BY updated_at ASC
      `)
            .all(organizationId, since.toISOString());
    }
    getCertificateTemplateById(id) {
        return this.db.prepare('SELECT * FROM certificate_templates WHERE id = ?').get(id);
    }
    getCertificateTemplateByClientId(clientId) {
        return this.db
            .prepare('SELECT * FROM certificate_templates WHERE client_id = ?')
            .get(clientId);
    }
    insertCertificateTemplate(template) {
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
    updateCertificateTemplate(template) {
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
    listCertificates(filters = {}) {
        const { sql, params } = this.buildCertificateQuery(filters, false);
        return this.db.prepare(`${sql} ORDER BY issue_date DESC LIMIT ? OFFSET ?`).all(...params, filters.limit ?? 100, filters.offset ?? 0);
    }
    countCertificates(filters = {}) {
        const { sql, params } = this.buildCertificateQuery(filters, true);
        const row = this.db.prepare(sql).get(...params);
        return row.count;
    }
    listCertificatesUpdatedSince(since, organizationId = 1) {
        return this.db
            .prepare(`
        SELECT * FROM certificates
        WHERE organization_id = ? AND updated_at > ?
        ORDER BY updated_at ASC
      `)
            .all(organizationId, since.toISOString());
    }
    getCertificateById(id) {
        return this.db.prepare('SELECT * FROM certificates WHERE id = ?').get(id);
    }
    getCertificateByClientId(clientId) {
        return this.db
            .prepare('SELECT * FROM certificates WHERE client_id = ?')
            .get(clientId);
    }
    getCertificateByVerificationCode(code) {
        return this.db
            .prepare('SELECT * FROM certificates WHERE verification_code = ?')
            .get(code);
    }
    getCertificateByNumber(organizationId, certificateNumber) {
        return this.db
            .prepare('SELECT * FROM certificates WHERE organization_id = ? AND certificate_number = ?')
            .get(organizationId, certificateNumber);
    }
    insertCertificate(certificate) {
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
    updateCertificate(certificate) {
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
    listAwards(filters = {}) {
        const { sql, params } = this.buildAwardQuery(filters, false);
        return this.db.prepare(`${sql} ORDER BY award_date DESC LIMIT ? OFFSET ?`).all(...params, filters.limit ?? 100, filters.offset ?? 0);
    }
    countAwards(filters = {}) {
        const { sql, params } = this.buildAwardQuery(filters, true);
        const row = this.db.prepare(sql).get(...params);
        return row.count;
    }
    listAwardsUpdatedSince(since, organizationId = 1) {
        return this.db
            .prepare(`
        SELECT * FROM awards
        WHERE organization_id = ? AND updated_at > ?
        ORDER BY updated_at ASC
      `)
            .all(organizationId, since.toISOString());
    }
    getAwardById(id) {
        return this.db.prepare('SELECT * FROM awards WHERE id = ?').get(id);
    }
    getAwardByClientId(clientId) {
        return this.db.prepare('SELECT * FROM awards WHERE client_id = ?').get(clientId);
    }
    getAwardByVerificationCode(code) {
        return this.db.prepare('SELECT * FROM awards WHERE verification_code = ?').get(code);
    }
    insertAward(award) {
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
    updateAward(award) {
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
    buildCertificateQuery(filters, countOnly) {
        const orgId = filters.organizationId ?? 1;
        const params = [orgId];
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
    buildAwardQuery(filters, countOnly) {
        const orgId = filters.organizationId ?? 1;
        const params = [orgId];
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
    getAllLookups() {
        const rows = this.db
            .prepare('SELECT category, value, label FROM lookup_options ORDER BY category, sort_order, id')
            .all();
        const lookups = {
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
    getLookupCategory(category) {
        if (!['class', 'grade', 'section', 'status', 'feeStatus'].includes(category)) {
            return null;
        }
        return this.db
            .prepare(`
        SELECT value, label FROM lookup_options
        WHERE category = ?
        ORDER BY sort_order, id
      `)
            .all(category);
    }
    seedLookups(defaults) {
        const row = this.db.prepare('SELECT COUNT(*) AS count FROM lookup_options').get();
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
    countLookups() {
        const row = this.db.prepare('SELECT COUNT(*) AS count FROM lookup_options').get();
        return row.count;
    }
    findAttendanceByUniqueKey(record) {
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
        });
    }
    toSqliteTable(table) {
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
exports.SqliteRepository = SqliteRepository;
function createSqliteRepository() {
    return new SqliteRepository(config_1.config.dbPath);
}
