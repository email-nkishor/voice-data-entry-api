import { UserRole } from '../types';

export type PermissionScope = 'all' | 'assigned_groups' | 'self' | 'children' | 'own';

export interface PermissionDef {
  module: string;
  action: string;
  description: string;
}

export const PERMISSIONS: PermissionDef[] = [
  { module: 'student', action: 'create', description: 'Create student records' },
  { module: 'student', action: 'edit', description: 'Edit student records' },
  { module: 'student', action: 'delete', description: 'Delete student records' },
  { module: 'student', action: 'view', description: 'View all students' },
  { module: 'student', action: 'view_self', description: 'View own student profile' },
  { module: 'group', action: 'create', description: 'Create groups' },
  { module: 'group', action: 'modify', description: 'Modify groups' },
  { module: 'group', action: 'assign', description: 'Assign students to groups' },
  { module: 'group', action: 'view', description: 'View groups' },
  { module: 'event', action: 'create', description: 'Create events' },
  { module: 'event', action: 'edit', description: 'Edit events' },
  { module: 'event', action: 'delete', description: 'Delete events' },
  { module: 'event', action: 'view', description: 'View all events' },
  { module: 'event', action: 'view_own', description: 'View own events' },
  { module: 'user', action: 'manage', description: 'Manage users' },
  { module: 'attendance', action: 'mark', description: 'Mark attendance' },
  { module: 'attendance', action: 'view', description: 'View attendance' },
  { module: 'attendance', action: 'view_self', description: 'View own attendance' },
  { module: 'attendance', action: 'view_child', description: 'View child attendance' },
  { module: 'certificate', action: 'create', description: 'Create certificates' },
  { module: 'certificate', action: 'edit', description: 'Edit certificates' },
  { module: 'certificate', action: 'revoke', description: 'Revoke certificates' },
  { module: 'certificate', action: 'view', description: 'View certificates' },
  { module: 'certificate', action: 'view_self', description: 'View own certificates' },
  { module: 'certificate', action: 'view_child', description: 'View child certificates' },
  { module: 'certificate', action: 'manage_templates', description: 'Manage certificate templates' },
  { module: 'award', action: 'create', description: 'Create and issue awards' },
  { module: 'award', action: 'recommend', description: 'Recommend awards for students' },
  { module: 'award', action: 'view', description: 'View awards' },
  { module: 'award', action: 'view_self', description: 'View own awards' },
  { module: 'award', action: 'view_child', description: 'View child awards' },
  { module: 'voice', action: 'create', description: 'Create voice entries' },
  { module: 'voice', action: 'view', description: 'View voice entry history' },
  { module: 'custom_field', action: 'manage', description: 'Manage custom field definitions' },
  { module: 'report', action: 'view', description: 'View reports and dashboards' },
  { module: 'report', action: 'view_self', description: 'View own analytics' },
  { module: 'parent', action: 'view_child_profile', description: 'View child profile' },
  { module: 'parent', action: 'view_child_events', description: 'View child events' },
  { module: 'parent', action: 'view_child_achievements', description: 'View child achievements' },
  { module: 'organization', action: 'manage', description: 'Manage organization settings' },
];

export function permissionKey(module: string, action: string): string {
  return `${module}:${action}`;
}

/** Maps role → permission keys with optional scope */
export const ROLE_PERMISSIONS: Record<
  UserRole,
  { key: string; scope?: PermissionScope }[]
> = {
  admin: PERMISSIONS.map((p) => ({ key: permissionKey(p.module, p.action), scope: 'all' as PermissionScope })),
  clerk: [
    { key: 'student:create', scope: 'all' },
    { key: 'student:edit', scope: 'all' },
    { key: 'student:view', scope: 'all' },
    { key: 'group:assign', scope: 'all' },
    { key: 'group:view', scope: 'all' },
    { key: 'event:create', scope: 'all' },
    { key: 'event:edit', scope: 'all' },
    { key: 'event:view', scope: 'all' },
    { key: 'attendance:mark', scope: 'all' },
    { key: 'attendance:view', scope: 'all' },
    { key: 'certificate:create', scope: 'all' },
    { key: 'certificate:edit', scope: 'all' },
    { key: 'certificate:revoke', scope: 'all' },
    { key: 'certificate:view', scope: 'all' },
    { key: 'award:create', scope: 'all' },
    { key: 'award:view', scope: 'all' },
    { key: 'voice:create', scope: 'all' },
    { key: 'voice:view', scope: 'all' },
    { key: 'report:view', scope: 'all' },
  ],
  admission_clerk: [], // resolved via normalizeRole → clerk
  teacher: [
    { key: 'student:view', scope: 'assigned_groups' },
    { key: 'group:view', scope: 'assigned_groups' },
    { key: 'event:view', scope: 'assigned_groups' },
    { key: 'attendance:mark', scope: 'assigned_groups' },
    { key: 'attendance:view', scope: 'assigned_groups' },
    { key: 'certificate:view', scope: 'assigned_groups' },
    { key: 'award:recommend', scope: 'assigned_groups' },
    { key: 'award:view', scope: 'assigned_groups' },
    { key: 'voice:create', scope: 'assigned_groups' },
    { key: 'voice:view', scope: 'assigned_groups' },
    { key: 'report:view', scope: 'assigned_groups' },
  ],
  student: [
    { key: 'student:view_self', scope: 'self' },
    { key: 'event:view_own', scope: 'self' },
    { key: 'attendance:view_self', scope: 'self' },
    { key: 'certificate:view_self', scope: 'self' },
    { key: 'award:view_self', scope: 'self' },
    { key: 'voice:view', scope: 'self' },
    { key: 'report:view_self', scope: 'self' },
  ],
  parent: [
    { key: 'parent:view_child_profile', scope: 'children' },
    { key: 'parent:view_child_events', scope: 'children' },
    { key: 'parent:view_child_achievements', scope: 'children' },
    { key: 'attendance:view_child', scope: 'children' },
    { key: 'certificate:view_child', scope: 'children' },
    { key: 'award:view_child', scope: 'children' },
    { key: 'voice:view', scope: 'children' },
    { key: 'report:view', scope: 'children' },
  ],
};

export function normalizeRole(role: UserRole): UserRole {
  if (role === 'admission_clerk') {
    return 'clerk';
  }
  return role;
}

export function getPermissionsForRole(role: UserRole): { key: string; scope: PermissionScope }[] {
  const normalized = normalizeRole(role);
  const perms = normalized === 'clerk' ? ROLE_PERMISSIONS.clerk : (ROLE_PERMISSIONS[normalized] ?? []);
  return perms.map((p) => ({
    key: p.key,
    scope: p.scope ?? 'all',
  }));
}

export function roleHasPermission(role: UserRole, module: string, action: string): boolean {
  const key = permissionKey(module, action);
  return getPermissionsForRole(role).some((p) => p.key === key);
}
