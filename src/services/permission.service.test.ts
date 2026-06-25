import { describe, expect, it } from 'vitest';
import { AuthUser } from '../types';
import { canAccessStudent, userHasPermission } from './permission.service';

function parentUser(linkedStudentIds: number[]): AuthUser {
  return {
    id: 4,
    email: 'parent@test.local',
    name: 'Parent',
    role: 'parent',
    organizationId: 1,
    permissions: [
      { key: 'parent:view_child_profile', scope: 'children' },
      { key: 'attendance:view_child', scope: 'children' },
    ],
    linkedStudentIds,
  };
}

describe('permission.service', () => {
  it('userHasPermission matches module:action keys', () => {
    const user = parentUser([1]);
    expect(userHasPermission(user, 'parent', 'view_child_profile')).toBe(true);
    expect(userHasPermission(user, 'student', 'delete')).toBe(false);
  });

  it('canAccessStudent allows parent for linked child only', () => {
    const user = parentUser([42]);
    expect(canAccessStudent(user, 42)).toBe(true);
    expect(canAccessStudent(user, 99)).toBe(false);
  });

  it('canAccessStudent allows admin scope all without linked students', () => {
    const admin: AuthUser = {
      id: 1,
      email: 'admin@test.local',
      name: 'Admin',
      role: 'admin',
      organizationId: 1,
      permissions: [{ key: 'student:view', scope: 'all' }],
      linkedStudentIds: [],
    };
    expect(canAccessStudent(admin, 1)).toBe(true);
    expect(canAccessStudent(admin, 999)).toBe(true);
  });
});
