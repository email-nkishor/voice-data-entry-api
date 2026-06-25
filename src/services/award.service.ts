import { randomBytes } from 'crypto';
import { getRepository } from '../db/database';
import {
  AuthUser,
  Award,
  AwardCategory,
  AwardFilters,
  AwardInput,
  AwardStatus,
  StudentAchievementSummary,
} from '../types';
import { logAudit } from './audit.service';
import { certificateToApi, listCertificatesForStudent } from './certificate.service';
import { canAccessStudent, getPermissionScope, userHasPermission } from './permission.service';
import { getUserById } from './user.service';

export function awardToApi(award: Award) {
  const repo = getRepository();
  const student = repo.getStudentById(award.student_id);
  const creator = award.created_by ? getUserById(award.created_by) : undefined;
  const recommender = award.recommended_by ? getUserById(award.recommended_by) : undefined;

  return {
    id: award.id,
    organizationId: award.organization_id,
    studentId: award.student_id,
    studentName: student?.name ?? null,
    category: award.category as AwardCategory,
    title: award.title,
    description: award.description,
    awardDate: award.award_date,
    issuedBy: award.issued_by,
    attachmentUrl: award.attachment_url,
    certificateId: award.certificate_id,
    status: award.status as AwardStatus,
    recommendedBy: award.recommended_by,
    recommendedByName: recommender?.name ?? null,
    verificationCode: award.verification_code,
    createdBy: award.created_by,
    createdByName: creator?.name ?? null,
    clientId: award.client_id,
    createdAt: award.created_at,
    updatedAt: award.updated_at,
  };
}

function generateVerificationCode(): string {
  return `AWD-${randomBytes(6).toString('hex').toUpperCase()}`;
}

function canAccessAward(user: AuthUser, award: Award): boolean {
  const viewScope = getPermissionScope(user, 'award', 'view')
    ?? getPermissionScope(user, 'award', 'view_self')
    ?? getPermissionScope(user, 'award', 'view_child');

  if (!viewScope) {
    return false;
  }

  switch (viewScope) {
    case 'all':
      return award.organization_id === user.organizationId;
    case 'self':
      return user.linkedStudentIds.includes(award.student_id);
    case 'children':
      return user.linkedStudentIds.includes(award.student_id);
    case 'assigned_groups':
      return canAccessStudent(user, award.student_id);
    default:
      return false;
  }
}

function filterByScope(user: AuthUser, awards: Award[]): Award[] {
  return awards.filter((a) => canAccessAward(user, a));
}

export function listAwards(user: AuthUser, filters: AwardFilters = {}) {
  const repo = getRepository();
  let items = repo.listAwards({ ...filters, organizationId: user.organizationId });
  items = filterByScope(user, items);
  const total = items.length;
  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? 50;
  return {
    items: items.slice(offset, offset + limit).map(awardToApi),
    total,
    limit,
    offset,
  };
}

export function getAwardById(user: AuthUser, id: number) {
  const award = getRepository().getAwardById(id);
  if (!award || !canAccessAward(user, award)) {
    return undefined;
  }
  return awardToApi(award);
}

export function getAwardByClientId(clientId: number) {
  return getRepository().getAwardByClientId(clientId);
}

export function listAwardsForStudent(user: AuthUser, studentId: number, limit = 20) {
  if (!canAccessStudent(user, studentId)) {
    const viewSelf = getPermissionScope(user, 'award', 'view_self');
    const viewChild = getPermissionScope(user, 'award', 'view_child');
    if (
      !(viewSelf && user.linkedStudentIds.includes(studentId)) &&
      !(viewChild && user.linkedStudentIds.includes(studentId))
    ) {
      return [];
    }
  }
  const items = getRepository().listAwards({
    organizationId: user.organizationId,
    studentId,
    limit: 100,
  });
  return filterByScope(user, items).slice(0, limit).map(awardToApi);
}

export function createAward(input: AwardInput, user: AuthUser) {
  const repo = getRepository();
  const isRecommend = input.status === 'recommended';

  if (isRecommend) {
    if (!userHasPermission(user, 'award', 'recommend') && !userHasPermission(user, 'award', 'create')) {
      throw new Error('Not authorized to recommend awards');
    }
    if (!canAccessStudent(user, input.studentId)) {
      throw new Error('Not authorized for this student');
    }
  } else if (!userHasPermission(user, 'award', 'create')) {
    throw new Error('Not authorized to create awards');
  } else if (!canAccessStudent(user, input.studentId)) {
    throw new Error('Not authorized for this student');
  }

  if (input.clientId) {
    const existing = repo.getAwardByClientId(input.clientId);
    if (existing) {
      return awardToApi(existing);
    }
  }

  const now = new Date().toISOString();
  const id = repo.nextId('awards');
  const status = (input.status ?? 'issued') as AwardStatus;

  const award: Award = {
    id,
    organization_id: user.organizationId,
    student_id: input.studentId,
    category: input.category,
    title: input.title.trim(),
    description: input.description?.trim() ?? null,
    award_date: input.awardDate,
    issued_by: input.issuedBy?.trim() ?? null,
    attachment_url: input.attachmentUrl ?? null,
    certificate_id: input.certificateId ?? null,
    status,
    recommended_by: isRecommend ? user.id : null,
    verification_code: status === 'issued' ? generateVerificationCode() : null,
    created_by: user.id,
    client_id: input.clientId ?? null,
    created_at: now,
    updated_at: now,
  };

  repo.insertAward(award);
  logAudit(
    'award',
    id,
    isRecommend ? 'recommended' : 'added',
    { studentId: input.studentId, title: award.title, category: award.category },
    user.id,
    user.organizationId
  );

  return awardToApi(award);
}

export function updateAward(id: number, input: Partial<AwardInput>, user: AuthUser) {
  const repo = getRepository();
  const existing = repo.getAwardById(id);
  if (!existing || !canAccessAward(user, existing)) {
    return undefined;
  }

  const newStatus = (input.status ?? existing.status) as AwardStatus;
  const updated: Award = {
    ...existing,
    category: input.category ?? existing.category,
    title: input.title?.trim() ?? existing.title,
    description: input.description !== undefined ? (input.description?.trim() ?? null) : existing.description,
    award_date: input.awardDate ?? existing.award_date,
    issued_by: input.issuedBy !== undefined ? input.issuedBy : existing.issued_by,
    attachment_url: input.attachmentUrl !== undefined ? input.attachmentUrl : existing.attachment_url,
    certificate_id: input.certificateId !== undefined ? input.certificateId : existing.certificate_id,
    status: newStatus,
    verification_code:
      newStatus === 'issued' && !existing.verification_code
        ? generateVerificationCode()
        : existing.verification_code,
    updated_at: new Date().toISOString(),
  };

  repo.updateAward(updated);
  logAudit('award', id, 'modified', { status: newStatus }, user.id, user.organizationId);
  return awardToApi(updated);
}

export function approveAward(id: number, user: AuthUser) {
  return updateAward(id, { status: 'approved' }, user);
}

export function revokeAward(id: number, user: AuthUser) {
  const repo = getRepository();
  const existing = repo.getAwardById(id);
  if (!existing || !canAccessAward(user, existing)) {
    return undefined;
  }
  const updated: Award = {
    ...existing,
    status: 'revoked',
    updated_at: new Date().toISOString(),
  };
  repo.updateAward(updated);
  logAudit('award', id, 'revoked', {}, user.id, user.organizationId);
  return awardToApi(updated);
}

export function getAwardStats(user: AuthUser) {
  const items = filterByScope(
    user,
    getRepository().listAwards({ organizationId: user.organizationId, limit: 10000 })
  );
  const byCategory: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const award of items) {
    byCategory[award.category] = (byCategory[award.category] ?? 0) + 1;
    byStatus[award.status] = (byStatus[award.status] ?? 0) + 1;
  }
  return { total: items.length, byCategory, byStatus };
}

export function getStudentAchievementSummary(user: AuthUser, studentId: number): StudentAchievementSummary | undefined {
  const repo = getRepository();
  const student = repo.getStudentById(studentId);
  if (!student) {
    return undefined;
  }

  const certs = listCertificatesForStudent(user, studentId, 5);
  const awards = listAwardsForStudent(user, studentId, 5);
  const allCertsApi = listCertificatesForStudent(user, studentId, 1000);
  const allAwardsApi = listAwardsForStudent(user, studentId, 1000);

  const certificatesByType: Record<string, number> = {};
  const awardsByCategory: Record<string, number> = {};
  for (const c of allCertsApi) {
    const type = String(c.certificateType);
    certificatesByType[type] = (certificatesByType[type] ?? 0) + 1;
  }
  for (const a of allAwardsApi) {
    awardsByCategory[a.category] = (awardsByCategory[a.category] ?? 0) + 1;
  }

  return {
    studentId,
    studentName: student.name,
    totalCertificates: allCertsApi.length,
    totalAwards: allAwardsApi.length,
    certificatesByType,
    awardsByCategory,
    recentCertificates: certs as unknown as Record<string, unknown>[],
    recentAwards: awards as unknown as Record<string, unknown>[],
  };
}

export function apiToAwardInput(payload: Record<string, unknown>): AwardInput {
  return {
    studentId: Number(payload['studentId']),
    category: payload['category'] as AwardCategory,
    title: String(payload['title'] ?? ''),
    description: payload['description'] != null ? String(payload['description']) : null,
    awardDate: String(payload['awardDate'] ?? new Date().toISOString().slice(0, 10)),
    issuedBy: payload['issuedBy'] != null ? String(payload['issuedBy']) : null,
    attachmentUrl: payload['attachmentUrl'] != null ? String(payload['attachmentUrl']) : null,
    certificateId: payload['certificateId'] != null ? Number(payload['certificateId']) : null,
    status: payload['status'] as AwardStatus | undefined,
    clientId: payload['clientId'] != null ? Number(payload['clientId']) : null,
  };
}
