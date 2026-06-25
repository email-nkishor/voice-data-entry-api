import { getRepository } from '../db/database';
import {
  getPermissionsForRole,
  normalizeRole,
  PERMISSIONS,
  permissionKey,
  PermissionScope,
} from '../config/permissions';
import { AuthUser, Permission, RolePermission, User, UserRole } from '../types';

export function buildAuthUser(user: User): AuthUser {
  const normalizedRole = normalizeRole(user.role);
  const permissions = getPermissionsForRole(user.role);
  const linkedStudentIds = getRepository().getLinkedStudentIds(user.id);

  if (user.linked_student_id && !linkedStudentIds.includes(user.linked_student_id)) {
    linkedStudentIds.push(user.linked_student_id);
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organization_id,
    permissions,
    linkedStudentIds,
  };
}

export function userHasPermission(
  user: AuthUser,
  module: string,
  action: string
): boolean {
  const key = permissionKey(module, action);
  return user.permissions.some((p) => p.key === key);
}

export function getPermissionScope(
  user: AuthUser,
  module: string,
  action: string
): PermissionScope | undefined {
  const key = permissionKey(module, action);
  return user.permissions.find((p) => p.key === key)?.scope;
}

export function seedPermissions(): void {
  const repo = getRepository();
  if (repo.countPermissions() > 0) {
    return;
  }

  const permissions: Permission[] = PERMISSIONS.map((p, index) => ({
    id: index + 1,
    module: p.module,
    action: p.action,
    description: p.description,
  }));

  const rolePermissions: RolePermission[] = [];
  let rpId = 1;

  const roles: UserRole[] = ['admin', 'clerk', 'teacher', 'student', 'parent'];
  for (const role of roles) {
    const perms = getPermissionsForRole(role);
    for (const perm of perms) {
      const def = PERMISSIONS.find((p) => permissionKey(p.module, p.action) === perm.key);
      if (!def) {
        continue;
      }
      const permId = permissions.findIndex(
        (p) => p.module === def.module && p.action === def.action
      ) + 1;
      rolePermissions.push({
        id: rpId++,
        role,
        permission_id: permId,
        scope: perm.scope,
      });
    }
  }

  repo.seedPermissionsAndRoles(permissions, rolePermissions);
}

export function canAccessStudent(user: AuthUser, studentId: number): boolean {
  const scope = getPermissionScope(user, 'student', 'view')
    ?? getPermissionScope(user, 'student', 'view_self');

  if (!scope) {
    return userHasPermission(user, 'parent', 'view_child_profile')
      && user.linkedStudentIds.includes(studentId);
  }

  switch (scope) {
    case 'all':
      return true;
    case 'self':
      return user.linkedStudentIds.includes(studentId) || user.linkedStudentIds[0] === studentId;
    case 'children':
      return user.linkedStudentIds.includes(studentId);
    case 'assigned_groups': {
      const repo = getRepository();
      const groupIds = repo.getTeacherGroupIds(user.id);
      const student = repo.getStudentById(studentId);
      if (!student) {
        return false;
      }
      if (student.group_id && groupIds.includes(student.group_id)) {
        return true;
      }
      const memberships = repo.listStudentGroups(studentId);
      return memberships.some((m) => groupIds.includes(m.group_id));
    }
    default:
      return false;
  }
}

export function getAccessibleGroupIds(user: AuthUser): number[] | 'all' {
  const normalized = normalizeRole(user.role);
  if (normalized === 'admin' || normalized === 'clerk') {
    return 'all';
  }
  if (normalized === 'teacher') {
    return getRepository().getTeacherGroupIds(user.id);
  }
  return [];
}
