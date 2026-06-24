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
    findUserByEmail(email) {
        return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    }
    findUserById(id) {
        return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    }
    insertUser(user) {
        this.db
            .prepare(`
        INSERT INTO users (id, email, password_hash, name, role, created_at)
        VALUES (@id, @email, @password_hash, @name, @role, @created_at)
      `)
            .run(user);
    }
    countUsers() {
        const row = this.db.prepare('SELECT COUNT(*) AS count FROM users').get();
        return row.count;
    }
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
    insertGroup(group) {
        this.db
            .prepare(`
        INSERT INTO student_groups (id, name, description, is_default, client_id, created_at)
        VALUES (@id, @name, @description, @is_default, @client_id, @created_at)
      `)
            .run(group);
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
    listStudents(groupId) {
        if (groupId) {
            return this.db
                .prepare('SELECT * FROM students WHERE group_id = ? ORDER BY created_at DESC')
                .all(groupId);
        }
        return this.db
            .prepare('SELECT * FROM students ORDER BY created_at DESC')
            .all();
    }
    listStudentsUpdatedSince(since) {
        return this.db
            .prepare('SELECT * FROM students WHERE updated_at > ? ORDER BY updated_at ASC')
            .all(since.toISOString());
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
          id, name, class, roll_no, mobile, address, admission_no, parent_name, parent_mobile,
          academic_year, section, status, fee_status, group_id, custom_data, client_id,
          created_at, updated_at
        ) VALUES (
          @id, @name, @class, @roll_no, @mobile, @address, @admission_no, @parent_name, @parent_mobile,
          @academic_year, @section, @status, @fee_status, @group_id, @custom_data, @client_id,
          @created_at, @updated_at
        )
      `)
            .run(student);
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
        }
    }
}
exports.SqliteRepository = SqliteRepository;
function createSqliteRepository() {
    return new SqliteRepository(config_1.config.dbPath);
}
