import {
  LookupCategory,
  LookupMap,
  LookupOption,
  Student,
  StudentActivity,
  StudentGroup,
  User,
} from '../types';

export type DbDriver = 'json' | 'sqlite';

export type IdTable = 'users' | 'studentGroups' | 'students' | 'studentActivities';

export interface DbRepository {
  readonly driver: DbDriver;

  findUserByEmail(email: string): User | undefined;
  findUserById(id: number): User | undefined;
  insertUser(user: User): void;
  countUsers(): number;

  listGroups(): StudentGroup[];
  listGroupsCreatedSince(since: Date): StudentGroup[];
  insertGroup(group: StudentGroup): void;
  deleteGroup(id: number): boolean;
  findGroupById(id: number): StudentGroup | undefined;
  countGroups(): number;

  listStudents(groupId?: number): Student[];
  listStudentsUpdatedSince(since: Date): Student[];
  getStudentById(id: number): Student | undefined;
  getStudentByClientId(clientId: number): Student | undefined;
  insertStudent(student: Student): void;
  updateStudentRecord(student: Student): boolean;
  deleteStudent(id: number): boolean;

  insertActivity(activity: StudentActivity): void;
  listActivities(studentId?: number, limit?: number): StudentActivity[];
  deleteActivitiesByStudentId(studentId: number): void;

  getAllLookups(): LookupMap;
  getLookupCategory(category: string): LookupOption[] | null;
  seedLookups(defaults: LookupMap): void;
  countLookups(): number;

  nextId(table: IdTable): number;
}
