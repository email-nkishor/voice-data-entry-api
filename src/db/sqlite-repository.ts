import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { config } from '../config';
import {
  LookupCategory,
  LookupMap,
  LookupOption,
  Student,
  StudentActivity,
  StudentGroup,
  User,
} from '../types';
import { findLegacyJsonPaths, migrateJsonToSqlite } from './migrate-json';
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

  findUserByEmail(email: string): User | undefined {
    return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
  }

  findUserById(id: number): User | undefined {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  }

  insertUser(user: User): void {
    this.db
      .prepare(`
        INSERT INTO users (id, email, password_hash, name, role, created_at)
        VALUES (@id, @email, @password_hash, @name, @role, @created_at)
      `)
      .run(user);
  }

  countUsers(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number };
    return row.count;
  }

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

  insertGroup(group: StudentGroup): void {
    this.db
      .prepare(`
        INSERT INTO student_groups (id, name, description, is_default, client_id, created_at)
        VALUES (@id, @name, @description, @is_default, @client_id, @created_at)
      `)
      .run(group);
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

  listStudents(groupId?: number): Student[] {
    if (groupId) {
      return this.db
        .prepare('SELECT * FROM students WHERE group_id = ? ORDER BY created_at DESC')
        .all(groupId) as Student[];
    }
    return this.db
      .prepare('SELECT * FROM students ORDER BY created_at DESC')
      .all() as Student[];
  }

  listStudentsUpdatedSince(since: Date): Student[] {
    return this.db
      .prepare('SELECT * FROM students WHERE updated_at > ? ORDER BY updated_at ASC')
      .all(since.toISOString()) as Student[];
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
    }
  }
}

export function createSqliteRepository(): SqliteRepository {
  return new SqliteRepository(config.dbPath);
}
