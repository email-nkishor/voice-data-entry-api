import { randomBytes } from 'crypto';
import { getRepository } from '../db/database';
import {
  AuthUser,
  Certificate,
  CertificateFilters,
  CertificateInput,
  CertificateStatus,
  CertificateType,
} from '../types';
import { logAudit } from './audit.service';
import { canAccessStudent, getPermissionScope } from './permission.service';
import { getUserById } from './user.service';

export function certificateToApi(cert: Certificate) {
  const repo = getRepository();
  const student = repo.getStudentById(cert.student_id);
  const creator = cert.created_by ? getUserById(cert.created_by) : undefined;
  const template = cert.template_id ? repo.getCertificateTemplateById(cert.template_id) : undefined;

  return {
    id: cert.id,
    organizationId: cert.organization_id,
    studentId: cert.student_id,
    studentName: student?.name ?? null,
    templateId: cert.template_id,
    templateName: template?.name ?? null,
    certificateNumber: cert.certificate_number,
    certificateType: cert.certificate_type as CertificateType,
    title: cert.title,
    description: cert.description,
    certificateName: cert.certificate_name,
    awardType: cert.award_type,
    issueDate: cert.issue_date,
    issuedBy: cert.issued_by,
    attachmentUrl: cert.attachment_url,
    verificationCode: cert.verification_code,
    status: cert.status as CertificateStatus,
    revokedAt: cert.revoked_at,
    revokedBy: cert.revoked_by,
    revokeReason: cert.revoke_reason,
    createdBy: cert.created_by,
    createdByName: creator?.name ?? null,
    clientId: cert.client_id,
    createdAt: cert.created_at,
    updatedAt: cert.updated_at,
  };
}

function generateVerificationCode(): string {
  return `CERT-${randomBytes(6).toString('hex').toUpperCase()}`;
}

function generateCertificateNumber(organizationId: number): string {
  const repo = getRepository();
  const year = new Date().getFullYear();
  const count = repo.countCertificates({ organizationId }) + 1;
  return `CERT-${organizationId}-${year}-${String(count).padStart(6, '0')}`;
}

function canAccessCertificate(user: AuthUser, cert: Certificate): boolean {
  const viewScope = getPermissionScope(user, 'certificate', 'view')
    ?? getPermissionScope(user, 'certificate', 'view_self')
    ?? getPermissionScope(user, 'certificate', 'view_child');

  if (!viewScope) {
    return false;
  }

  switch (viewScope) {
    case 'all':
      return cert.organization_id === user.organizationId;
    case 'self':
      return user.linkedStudentIds.includes(cert.student_id);
    case 'children':
      return user.linkedStudentIds.includes(cert.student_id);
    case 'assigned_groups':
      return canAccessStudent(user, cert.student_id);
    default:
      return false;
  }
}

function filterByScope(user: AuthUser, certs: Certificate[]): Certificate[] {
  return certs.filter((c) => canAccessCertificate(user, c));
}

export function listCertificates(user: AuthUser, filters: CertificateFilters = {}) {
  const repo = getRepository();
  const scoped = { ...filters, organizationId: user.organizationId };
  let items = repo.listCertificates(scoped);
  items = filterByScope(user, items);
  const total = items.length;
  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? 50;
  return {
    items: items.slice(offset, offset + limit).map(certificateToApi),
    total,
    limit,
    offset,
  };
}

export function getCertificateById(user: AuthUser, id: number) {
  const cert = getRepository().getCertificateById(id);
  if (!cert || !canAccessCertificate(user, cert)) {
    return undefined;
  }
  return certificateToApi(cert);
}

export function getCertificateByClientId(clientId: number) {
  return getRepository().getCertificateByClientId(clientId);
}

export function verifyCertificate(code: string) {
  const cert = getRepository().getCertificateByVerificationCode(code);
  if (!cert) {
    return { valid: false as const, message: 'Certificate not found' };
  }
  if (cert.status === 'revoked') {
    return {
      valid: false as const,
      message: 'Certificate has been revoked',
      certificate: certificateToApi(cert),
    };
  }
  return {
    valid: true as const,
    message: 'Certificate is valid',
    certificate: certificateToApi(cert),
  };
}

export function listCertificatesForStudent(user: AuthUser, studentId: number, limit = 20) {
  if (!canAccessStudent(user, studentId)) {
    const viewSelf = getPermissionScope(user, 'certificate', 'view_self');
    const viewChild = getPermissionScope(user, 'certificate', 'view_child');
    if (
      !(viewSelf && user.linkedStudentIds.includes(studentId)) &&
      !(viewChild && user.linkedStudentIds.includes(studentId))
    ) {
      return [];
    }
  }
  const items = getRepository().listCertificates({
    organizationId: user.organizationId,
    studentId,
    limit: 100,
  });
  return filterByScope(user, items).slice(0, limit).map(certificateToApi);
}

export function createCertificate(input: CertificateInput, user: AuthUser) {
  const repo = getRepository();
  if (!canAccessStudent(user, input.studentId)) {
    throw new Error('Not authorized to issue certificate for this student');
  }
  if (input.clientId) {
    const existing = repo.getCertificateByClientId(input.clientId);
    if (existing) {
      return certificateToApi(existing);
    }
  }

  const now = new Date().toISOString();
  const id = repo.nextId('certificates');
  const certType = (input.certificateType ?? 'achievement') as CertificateType;
  const title = input.title.trim();
  const certNumber = generateCertificateNumber(user.organizationId);
  const status = (input.status ?? 'issued') as CertificateStatus;

  const cert: Certificate = {
    id,
    organization_id: user.organizationId,
    student_id: input.studentId,
    template_id: input.templateId ?? null,
    certificate_number: certNumber,
    certificate_type: certType,
    title,
    description: input.description?.trim() ?? null,
    certificate_name: title,
    award_type: certType,
    issue_date: input.issueDate,
    issued_by: input.issuedBy.trim(),
    attachment_url: input.attachmentUrl ?? null,
    verification_code: generateVerificationCode(),
    status,
    revoked_at: null,
    revoked_by: null,
    revoke_reason: null,
    created_by: user.id,
    client_id: input.clientId ?? null,
    created_at: now,
    updated_at: now,
  };

  repo.insertCertificate(cert);
  logAudit('certificate', id, 'issued', {
    studentId: input.studentId,
    certificateNumber: certNumber,
    title,
  }, user.id, user.organizationId);

  return certificateToApi(cert);
}

export function updateCertificate(id: number, input: Partial<CertificateInput>, user: AuthUser) {
  const repo = getRepository();
  const existing = repo.getCertificateById(id);
  if (!existing || !canAccessCertificate(user, existing)) {
    return undefined;
  }
  if (existing.status === 'revoked') {
    throw new Error('Cannot modify a revoked certificate');
  }

  const updated: Certificate = {
    ...existing,
    template_id: input.templateId !== undefined ? input.templateId : existing.template_id,
    certificate_type: (input.certificateType ?? existing.certificate_type) as CertificateType,
    title: input.title?.trim() ?? existing.title,
    description: input.description !== undefined ? (input.description?.trim() ?? null) : existing.description,
    certificate_name: input.title?.trim() ?? existing.certificate_name,
    award_type: (input.certificateType ?? existing.award_type) as string,
    issue_date: input.issueDate ?? existing.issue_date,
    issued_by: input.issuedBy?.trim() ?? existing.issued_by,
    attachment_url: input.attachmentUrl !== undefined ? input.attachmentUrl : existing.attachment_url,
    status: (input.status ?? existing.status) as CertificateStatus,
    updated_at: new Date().toISOString(),
  };

  repo.updateCertificate(updated);
  logAudit('certificate', id, 'modified', { title: updated.title }, user.id, user.organizationId);
  return certificateToApi(updated);
}

export function revokeCertificate(id: number, reason: string, user: AuthUser) {
  const repo = getRepository();
  const existing = repo.getCertificateById(id);
  if (!existing || existing.organization_id !== user.organizationId) {
    return undefined;
  }
  if (existing.status === 'revoked') {
    return certificateToApi(existing);
  }

  const updated: Certificate = {
    ...existing,
    status: 'revoked',
    revoked_at: new Date().toISOString(),
    revoked_by: user.id,
    revoke_reason: reason.trim() || null,
    updated_at: new Date().toISOString(),
  };
  repo.updateCertificate(updated);
  logAudit('certificate', id, 'revoked', { reason }, user.id, user.organizationId);
  return certificateToApi(updated);
}

export function getCertificateStats(user: AuthUser) {
  const items = filterByScope(
    user,
    getRepository().listCertificates({ organizationId: user.organizationId, limit: 10000 })
  );
  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};
  for (const cert of items) {
    byStatus[cert.status] = (byStatus[cert.status] ?? 0) + 1;
    byType[cert.certificate_type] = (byType[cert.certificate_type] ?? 0) + 1;
  }
  return { total: items.length, byStatus, byType };
}

export function apiToCertificateInput(payload: Record<string, unknown>): CertificateInput {
  return {
    studentId: Number(payload['studentId']),
    templateId: payload['templateId'] != null ? Number(payload['templateId']) : null,
    certificateType: payload['certificateType'] as CertificateType | undefined,
    title: String(payload['title'] ?? ''),
    description: payload['description'] != null ? String(payload['description']) : null,
    issueDate: String(payload['issueDate'] ?? new Date().toISOString().slice(0, 10)),
    issuedBy: String(payload['issuedBy'] ?? ''),
    attachmentUrl: payload['attachmentUrl'] != null ? String(payload['attachmentUrl']) : null,
    status: payload['status'] as CertificateStatus | undefined,
    clientId: payload['clientId'] != null ? Number(payload['clientId']) : null,
  };
}
