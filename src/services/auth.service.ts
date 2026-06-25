import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getRepository } from '../db/database';
import { config } from '../config';
import { AuthUser, User, UserRole } from '../types';
import { buildAuthUser } from './permission.service';
import { seedDefaultOrganization } from './organization.service';
import { seedPermissions } from './permission.service';
import { linkParentToStudent } from './user.service';
import { syncParentEntitiesFromUserLinks } from './parent-entity.service';

export function findUserByEmail(email: string): User | undefined {
  return getRepository().findUserByEmail(email);
}

export function findUserById(id: number): User | undefined {
  return getRepository().findUserById(id);
}

export function createUser(
  email: string,
  password: string,
  name: string,
  role: UserRole,
  linkedStudentId?: number
): number {
  const repo = getRepository();
  const hash = bcrypt.hashSync(password, 10);
  const id = repo.nextId('users');
  const user: User = {
    id,
    organization_id: 1,
    email,
    password_hash: hash,
    name,
    role,
    status: 'active',
    linked_student_id: linkedStudentId ?? null,
    created_at: new Date().toISOString(),
  };
  repo.insertUser(user);
  return id;
}

export function verifyPassword(user: User, password: string): boolean {
  return bcrypt.compareSync(password, user.password_hash);
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      organizationId: user.organizationId,
      permissions: user.permissions,
      linkedStudentIds: user.linkedStudentIds,
    },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

export function toAuthUser(user: User): AuthUser {
  return buildAuthUser(user);
}

export function seedDefaultUsers(): void {
  seedDefaultOrganization();
  seedPermissions();

  const repo = getRepository();
  if (repo.countUsers() === 0) {
    const users: [string, string, string, UserRole][] = [
      ['admin@institute.local', 'admin123', 'Institute Admin', 'admin'],
      ['clerk@institute.local', 'clerk123', 'Admission Clerk', 'clerk'],
      ['teacher@institute.local', 'teacher123', 'Class Teacher', 'teacher'],
      ['parent@institute.local', 'parent123', 'Parent User', 'parent'],
      ['student@institute.local', 'student123', 'Student User', 'student'],
    ];
    for (const [email, password, name, role] of users) {
      createUser(email, password, name, role);
    }
  } else {
    ensureDefaultUsers();
  }

  // Assign teacher to first non-default group
  const groups = repo.listGroups();
  const teacher = repo.findUserByEmail('teacher@institute.local');
  const teachGroup = groups.find((g) => !g.is_default) ?? groups[0];
  if (teacher && teachGroup) {
    const existing = repo.getTeacherGroupIds(teacher.id);
    if (!existing.includes(teachGroup.id)) {
      repo.assignTeacherToGroup({
        id: repo.nextId('teacherGroupAssignments'),
        organization_id: 1,
        user_id: teacher.id,
        group_id: teachGroup.id,
      });
    }
  }
}

const DEFAULT_USER_SEEDS: [string, string, string, UserRole][] = [
  ['admin@institute.local', 'admin123', 'Institute Admin', 'admin'],
  ['clerk@institute.local', 'clerk123', 'Admission Clerk', 'clerk'],
  ['teacher@institute.local', 'teacher123', 'Class Teacher', 'teacher'],
  ['parent@institute.local', 'parent123', 'Parent User', 'parent'],
  ['student@institute.local', 'student123', 'Student User', 'student'],
];

/** Add any missing demo accounts and backfill legacy user fields. */
export function ensureDefaultUsers(): void {
  const repo = getRepository();
  for (const [email, password, name, role] of DEFAULT_USER_SEEDS) {
    const existing = repo.findUserByEmail(email);
    if (!existing) {
      createUser(email, password, name, role);
      continue;
    }
    const patched = {
      ...existing,
      status: existing.status || 'active',
      organization_id: existing.organization_id ?? 1,
      linked_student_id: existing.linked_student_id ?? null,
    };
    if (
      patched.status !== existing.status ||
      patched.organization_id !== existing.organization_id ||
      patched.linked_student_id !== existing.linked_student_id
    ) {
      repo.updateUser(patched);
    }
  }
}

export function seedDefaultGroups(): void {
  const repo = getRepository();
  if (repo.countGroups() > 0) {
    return;
  }
  const groups: [string, string, number][] = [
    ['General Admission', 'Default student group', 1],
    ['MCA Batch 2026', 'Master of Computer Applications', 0],
    ['BCA Batch 2026', 'Bachelor of Computer Applications', 0],
  ];
  for (const [name, desc, isDefault] of groups) {
    const id = repo.nextId('studentGroups');
    repo.insertGroup({
      id,
      organization_id: 1,
      name,
      description: desc,
      is_default: isDefault,
      client_id: null,
      created_at: new Date().toISOString(),
    });
  }
}

export function seedDemoStudentAndLinks(): void {
  const repo = getRepository();
  const existingStudent = repo.listStudents()[0];
  if (existingStudent) {
    linkDemoAccounts(existingStudent.id);
    syncParentEntitiesFromUserLinks();
    return;
  }

  const now = new Date().toISOString();
  const group = repo.listGroups().find((g) => g.is_default) ?? repo.listGroups()[0];
  const studentId = repo.nextId('students');
  repo.insertStudent({
    id: studentId,
    organization_id: 1,
    name: 'Demo Student',
    class: '10',
    roll_no: '001',
    mobile: '9876543210',
    address: 'Demo Address',
    admission_no: 'ADM001',
    parent_name: 'Parent User',
    parent_mobile: '9876543211',
    academic_year: '2025-26',
    section: 'A',
    status: 'active',
    fee_status: 'paid',
    group_id: group?.id ?? null,
    custom_data: null,
    client_id: null,
    created_at: now,
    updated_at: now,
  });

  linkDemoAccounts(studentId);
  syncParentEntitiesFromUserLinks();
}

function linkDemoAccounts(studentId: number): void {
  const repo = getRepository();
  const parent = repo.findUserByEmail('parent@institute.local');
  const studentUser = repo.findUserByEmail('student@institute.local');

  if (parent) {
    linkParentToStudent(parent.id, studentId, 'guardian');
    const updatedParent = repo.findUserById(parent.id);
    if (updatedParent) {
      repo.updateUser({ ...updatedParent, linked_student_id: studentId });
    }
  }

  if (studentUser) {
    repo.updateUser({
      ...studentUser,
      linked_student_id: studentId,
    });
  }
}
