import { getRepository } from '../db/database';
import {
  Parent,
  ParentNotificationPreferences,
  ParentRelationshipType,
  ParentStudentMapping,
  User,
} from '../types';

const RELATIONSHIP_TYPES = new Set<ParentRelationshipType>([
  'father',
  'mother',
  'guardian',
  'grandparent',
  'other',
]);

export function normalizeRelationshipType(value: string): ParentRelationshipType {
  const normalized = value.toLowerCase() as ParentRelationshipType;
  return RELATIONSHIP_TYPES.has(normalized) ? normalized : 'guardian';
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) {
    return { firstName: parts[0] ?? 'Parent', lastName: '' };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function ensureParentForUser(user: User): Parent {
  const repo = getRepository();
  const existing = repo.getParentByUserId(user.id);
  if (existing) {
    return existing;
  }

  const { firstName, lastName } = splitName(user.name);
  const now = new Date().toISOString();
  const parent: Parent = {
    id: repo.nextId('parents'),
    organization_id: user.organization_id,
    first_name: firstName,
    last_name: lastName,
    email: user.email,
    phone: null,
    user_id: user.id,
    status: user.status === 'inactive' ? 'inactive' : 'active',
    client_id: null,
    created_at: now,
    updated_at: now,
  };
  repo.insertParent(parent);
  ensureDefaultNotificationPreferences(parent);
  return parent;
}

export function ensureParentStudentMapping(
  parentId: number,
  studentId: number,
  relationshipType: string,
  isPrimary = false,
  organizationId = 1
): ParentStudentMapping {
  const repo = getRepository();
  const existing = repo.getParentMapping(parentId, studentId);
  if (existing) {
    return existing;
  }

  const mapping: ParentStudentMapping = {
    id: repo.nextId('parentStudentMappings'),
    organization_id: organizationId,
    parent_id: parentId,
    student_id: studentId,
    relationship_type: normalizeRelationshipType(relationshipType),
    is_primary_contact: isPrimary ? 1 : 0,
    client_id: null,
    created_at: new Date().toISOString(),
  };
  repo.insertParentMapping(mapping);
  return mapping;
}

export function ensureDefaultNotificationPreferences(parent: Parent): ParentNotificationPreferences {
  const repo = getRepository();
  const existing = repo.getParentNotificationPreferences(parent.id);
  if (existing) {
    return existing;
  }

  const prefs: ParentNotificationPreferences = {
    id: repo.nextId('parentNotificationPreferences'),
    organization_id: parent.organization_id,
    parent_id: parent.id,
    email_enabled: 1,
    sms_enabled: 0,
    push_enabled: 0,
    event_assigned: 1,
    certificate_issued: 1,
    award_added: 1,
    attendance_alert: 1,
    client_id: null,
    updated_at: new Date().toISOString(),
  };
  return repo.upsertParentNotificationPreferences(prefs);
}

export function syncParentEntitiesFromUserLinks(): void {
  const repo = getRepository();
  const parentUsers = repo.listUsers(1).filter((u) => u.role === 'parent');
  for (const user of parentUsers) {
    const parent = ensureParentForUser(user);
    const links = repo.getLinkedStudents(user.id);
    for (const link of links) {
      ensureParentStudentMapping(
        parent.id,
        link.student_id,
        link.relationship,
        link.is_primary === 1,
        user.organization_id
      );
    }
  }
}

export function parentToApi(parent: Parent) {
  return {
    id: parent.id,
    firstName: parent.first_name,
    lastName: parent.last_name,
    email: parent.email,
    phone: parent.phone,
    userId: parent.user_id,
    organizationId: parent.organization_id,
    status: parent.status,
    createdAt: parent.created_at,
    updatedAt: parent.updated_at,
  };
}

export function notificationPreferencesToApi(prefs: ParentNotificationPreferences) {
  return {
    parentId: prefs.parent_id,
    emailEnabled: prefs.email_enabled === 1,
    smsEnabled: prefs.sms_enabled === 1,
    pushEnabled: prefs.push_enabled === 1,
    eventAssigned: prefs.event_assigned === 1,
    certificateIssued: prefs.certificate_issued === 1,
    awardAdded: prefs.award_added === 1,
    attendanceAlert: prefs.attendance_alert === 1,
    updatedAt: prefs.updated_at,
  };
}
