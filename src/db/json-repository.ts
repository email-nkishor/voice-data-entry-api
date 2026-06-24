import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { LookupMap, LookupOption, Student, StudentActivity, StudentGroup, User } from '../types';
import { DbRepository, IdTable } from './repository';

interface JsonDbSchema {
  users: User[];
  studentGroups: StudentGroup[];
  students: Student[];
  studentActivities: StudentActivity[];
  lookups: LookupMap;
  nextIds: Record<IdTable, number>;
}

const EMPTY_DB: JsonDbSchema = {
  users: [],
  studentGroups: [],
  students: [],
  studentActivities: [],
  lookups: {
    class: [],
    grade: [],
    section: [],
    status: [],
    feeStatus: [],
  },
  nextIds: {
    users: 1,
    studentGroups: 1,
    students: 1,
    studentActivities: 1,
  },
};

export class JsonRepository implements DbRepository {
  readonly driver = 'json' as const;
  private cache: JsonDbSchema | null = null;

  constructor(private readonly filePath: string) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private load(): JsonDbSchema {
    if (this.cache) {
      return this.cache;
    }
    if (!fs.existsSync(this.filePath)) {
      this.cache = structuredClone(EMPTY_DB);
      this.save();
      return this.cache;
    }
    const raw = fs.readFileSync(this.filePath, 'utf-8');
    this.cache = { ...EMPTY_DB, ...JSON.parse(raw) } as JsonDbSchema;
    return this.cache;
  }

  private save(): void {
    if (!this.cache) {
      return;
    }
    fs.writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2), 'utf-8');
  }

  nextId(table: IdTable): number {
    const db = this.load();
    const id = db.nextIds[table];
    db.nextIds[table] = id + 1;
    this.save();
    return id;
  }

  findUserByEmail(email: string): User | undefined {
    return this.load().users.find((user) => user.email === email);
  }

  findUserById(id: number): User | undefined {
    return this.load().users.find((user) => user.id === id);
  }

  insertUser(user: User): void {
    this.load().users.push(user);
    this.save();
  }

  countUsers(): number {
    return this.load().users.length;
  }

  listGroups(): StudentGroup[] {
    return [...this.load().studentGroups].sort((a, b) => a.name.localeCompare(b.name));
  }

  listGroupsCreatedSince(since: Date): StudentGroup[] {
    const sinceTime = since.getTime();
    return this.load().studentGroups.filter(
      (group) => new Date(group.created_at).getTime() > sinceTime
    );
  }

  insertGroup(group: StudentGroup): void {
    this.load().studentGroups.push(group);
    this.save();
  }

  deleteGroup(id: number): boolean {
    const db = this.load();
    const group = db.studentGroups.find((item) => item.id === id);
    if (!group || group.is_default) {
      return false;
    }
    db.studentGroups = db.studentGroups.filter((item) => item.id !== id);
    this.save();
    return true;
  }

  findGroupById(id: number): StudentGroup | undefined {
    return this.load().studentGroups.find((group) => group.id === id);
  }

  countGroups(): number {
    return this.load().studentGroups.length;
  }

  listStudents(groupId?: number): Student[] {
    const students = [...this.load().students].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    if (groupId) {
      return students.filter((student) => student.group_id === groupId);
    }
    return students;
  }

  listStudentsUpdatedSince(since: Date): Student[] {
    const sinceTime = since.getTime();
    return this.load().students.filter(
      (student) => new Date(student.updated_at).getTime() > sinceTime
    );
  }

  getStudentById(id: number): Student | undefined {
    return this.load().students.find((student) => student.id === id);
  }

  getStudentByClientId(clientId: number): Student | undefined {
    return this.load().students.find((student) => student.client_id === clientId);
  }

  insertStudent(student: Student): void {
    this.load().students.push(student);
    this.save();
  }

  updateStudentRecord(student: Student): boolean {
    const db = this.load();
    const index = db.students.findIndex((item) => item.id === student.id);
    if (index < 0) {
      return false;
    }
    db.students[index] = student;
    this.save();
    return true;
  }

  deleteStudent(id: number): boolean {
    const db = this.load();
    const index = db.students.findIndex((student) => student.id === id);
    if (index < 0) {
      return false;
    }
    db.students.splice(index, 1);
    db.studentActivities = db.studentActivities.filter((activity) => activity.student_id !== id);
    this.save();
    return true;
  }

  insertActivity(activity: StudentActivity): void {
    this.load().studentActivities.push(activity);
    this.save();
  }

  listActivities(studentId?: number, limit = 20): StudentActivity[] {
    let items = [...this.load().studentActivities].sort((a, b) => b.id - a.id);
    if (studentId) {
      items = items.filter((activity) => activity.student_id === studentId);
    }
    return items.slice(0, limit);
  }

  deleteActivitiesByStudentId(studentId: number): void {
    const db = this.load();
    db.studentActivities = db.studentActivities.filter(
      (activity) => activity.student_id !== studentId
    );
    this.save();
  }

  getAllLookups(): LookupMap {
    return this.load().lookups ?? structuredClone(EMPTY_DB.lookups);
  }

  getLookupCategory(category: string): LookupOption[] | null {
    const lookups = this.getAllLookups();
    if (!(category in lookups)) {
      return null;
    }
    return lookups[category as keyof LookupMap] ?? [];
  }

  seedLookups(defaults: LookupMap): void {
    const db = this.load();
    if (!db.lookups) {
      db.lookups = structuredClone(defaults);
      this.save();
      return;
    }

    let changed = false;
    for (const [key, options] of Object.entries(defaults)) {
      const category = key as keyof LookupMap;
      if (!db.lookups[category]?.length) {
        db.lookups[category] = structuredClone(options);
        changed = true;
      }
    }

    if (changed) {
      this.save();
    }
  }

  countLookups(): number {
    const lookups = this.getAllLookups();
    return Object.values(lookups).reduce((total, options) => total + options.length, 0);
  }
}

export function createJsonRepository(): JsonRepository {
  return new JsonRepository(config.dbPath);
}
