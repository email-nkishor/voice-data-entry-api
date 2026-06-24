"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findLegacyJsonPaths = findLegacyJsonPaths;
exports.migrateJsonToSqlite = migrateJsonToSqlite;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function isJsonFile(filePath) {
    if (!fs_1.default.existsSync(filePath)) {
        return false;
    }
    const head = fs_1.default.readFileSync(filePath, 'utf-8').trimStart();
    return head.startsWith('{');
}
function readLegacyJson(filePath) {
    if (!isJsonFile(filePath)) {
        return null;
    }
    try {
        return JSON.parse(fs_1.default.readFileSync(filePath, 'utf-8'));
    }
    catch {
        return null;
    }
}
function findLegacyJsonPaths(sqlitePath) {
    const dir = path_1.default.dirname(sqlitePath);
    const candidates = [];
    if (process.env.LEGACY_JSON_PATH) {
        candidates.push(path_1.default.resolve(process.env.LEGACY_JSON_PATH));
    }
    else {
        candidates.push(path_1.default.join(dir, 'institute.json'));
    }
    return candidates.filter((candidate) => path_1.default.resolve(candidate) !== path_1.default.resolve(sqlitePath) && isJsonFile(candidate));
}
function migrateJsonToSqlite(db, jsonPath) {
    const legacy = readLegacyJson(jsonPath);
    if (!legacy) {
        return false;
    }
    const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get();
    if (userCount.count > 0) {
        return false;
    }
    const insertUser = db.prepare(`
    INSERT INTO users (id, email, password_hash, name, role, created_at)
    VALUES (@id, @email, @password_hash, @name, @role, @created_at)
  `);
    const insertGroup = db.prepare(`
    INSERT INTO student_groups (id, name, description, is_default, client_id, created_at)
    VALUES (@id, @name, @description, @is_default, @client_id, @created_at)
  `);
    const insertStudent = db.prepare(`
    INSERT INTO students (
      id, name, class, roll_no, mobile, address, admission_no, parent_name, parent_mobile,
      academic_year, section, status, fee_status, group_id, custom_data, client_id,
      created_at, updated_at
    ) VALUES (
      @id, @name, @class, @roll_no, @mobile, @address, @admission_no, @parent_name, @parent_mobile,
      @academic_year, @section, @status, @fee_status, @group_id, @custom_data, @client_id,
      @created_at, @updated_at
    )
  `);
    const insertActivity = db.prepare(`
    INSERT INTO student_activities (id, student_id, action, message, action_date, logged_date, user_id)
    VALUES (@id, @student_id, @action, @message, @action_date, @logged_date, @user_id)
  `);
    const insertLookup = db.prepare(`
    INSERT OR IGNORE INTO lookup_options (category, value, label, sort_order)
    VALUES (@category, @value, @label, @sort_order)
  `);
    const migrate = db.transaction(() => {
        for (const user of legacy.users ?? []) {
            insertUser.run(user);
        }
        for (const group of legacy.studentGroups ?? []) {
            insertGroup.run(group);
        }
        for (const student of legacy.students ?? []) {
            insertStudent.run(student);
        }
        for (const activity of legacy.studentActivities ?? []) {
            insertActivity.run(activity);
        }
        for (const [category, options] of Object.entries(legacy.lookups ?? {})) {
            options?.forEach((option, index) => {
                insertLookup.run({
                    category,
                    value: option.value,
                    label: option.label,
                    sort_order: index,
                });
            });
        }
        updateSqliteSequences(db);
    });
    migrate();
    const backupPath = `${jsonPath}.migrated-${Date.now()}.json`;
    fs_1.default.renameSync(jsonPath, backupPath);
    console.log(`Migrated legacy JSON DB from ${jsonPath} → SQLite (backup: ${backupPath})`);
    return true;
}
function updateSqliteSequences(db) {
    const tables = ['users', 'student_groups', 'students', 'student_activities', 'lookup_options'];
    for (const table of tables) {
        const row = db.prepare(`SELECT MAX(id) AS maxId FROM ${table}`).get();
        if (row.maxId != null) {
            db.prepare(`INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES (?, ?)`).run(table, row.maxId);
        }
    }
}
