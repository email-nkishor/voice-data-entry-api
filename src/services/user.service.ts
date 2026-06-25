import bcrypt from 'bcryptjs';
import { getRepository } from '../db/database';
import { CreateUserInput, UpdateUserInput, User, UserRole, UserStudentLink } from '../types';
import {
  ensureParentForUser,
  ensureParentStudentMapping,
  normalizeRelationshipType,
} from './parent-entity.service';

export function listUsers() {
  return getRepository()
    .listUsers(1)
    .map(userToApi);
}

export function getUserById(id: number): User | undefined {
  return getRepository().findUserById(id);
}

export function createUserAccount(input: CreateUserInput): User {
  const repo = getRepository();
  const email = input.email.trim().toLowerCase();

  if (repo.findUserByEmail(email)) {
    throw new Error('Email already exists');
  }

  const id = repo.nextId('users');
  const now = new Date().toISOString();
  const user: User = {
    id,
    organization_id: 1,
    email,
    password_hash: bcrypt.hashSync(input.password, 10),
    name: input.name.trim(),
    role: input.role,
    status: 'active',
    linked_student_id: input.linkedStudentId ?? null,
    created_at: now,
  };
  repo.insertUser(user);

  if (input.role === 'parent' && input.linkedStudentId) {
    linkParentToStudent(id, input.linkedStudentId, 'guardian');
  }

  return user;
}

export function updateUserAccount(id: number, input: UpdateUserInput): User | undefined {
  const repo = getRepository();
  const existing = repo.findUserById(id);
  if (!existing) {
    return undefined;
  }

  const updated: User = {
    ...existing,
    email: input.email?.trim().toLowerCase() ?? existing.email,
    name: input.name?.trim() ?? existing.name,
    role: input.role ?? existing.role,
    status: input.status ?? existing.status,
    linked_student_id:
      input.linkedStudentId !== undefined ? input.linkedStudentId : existing.linked_student_id,
    password_hash: input.password
      ? bcrypt.hashSync(input.password, 10)
      : existing.password_hash,
  };

  if (!repo.updateUser(updated)) {
    return undefined;
  }
  return updated;
}

export function deleteUserAccount(id: number): boolean {
  return getRepository().deleteUser(id);
}

export function linkParentToStudent(
  userId: number,
  studentId: number,
  relationship = 'guardian'
): UserStudentLink {
  const repo = getRepository();
  const id = repo.nextId('userStudentLinks');
  const link: UserStudentLink = {
    id,
    organization_id: 1,
    user_id: userId,
    student_id: studentId,
    relationship,
    is_primary: 1,
    created_at: new Date().toISOString(),
  };
  repo.linkParentToStudent(link);

  const user = repo.findUserById(userId);
  if (user?.role === 'parent') {
    const parent = ensureParentForUser(user);
    ensureParentStudentMapping(
      parent.id,
      studentId,
      normalizeRelationshipType(relationship),
      link.is_primary === 1,
      user.organization_id
    );
  }

  return link;
}

export function userToApi(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    organizationId: user.organization_id,
    linkedStudentId: user.linked_student_id,
    createdAt: user.created_at,
  };
}

export function isStaffRole(role: UserRole): boolean {
  return ['admin', 'clerk', 'admission_clerk', 'teacher'].includes(role);
}
