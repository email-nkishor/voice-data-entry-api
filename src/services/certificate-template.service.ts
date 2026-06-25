import { getRepository } from '../db/database';
import {
  AuthUser,
  CertificateTemplate,
  CertificateTemplateInput,
  CertificateType,
} from '../types';
import { logAudit } from './audit.service';
import { getUserById } from './user.service';

export function templateToApi(template: CertificateTemplate) {
  const creator = template.created_by ? getUserById(template.created_by) : undefined;
  return {
    id: template.id,
    organizationId: template.organization_id,
    name: template.name,
    description: template.description,
    certificateType: template.certificate_type as CertificateType,
    templateUrl: template.template_url,
    isActive: !!template.is_active,
    createdBy: template.created_by,
    createdByName: creator?.name ?? null,
    clientId: template.client_id,
    createdAt: template.created_at,
    updatedAt: template.updated_at,
  };
}

export function listTemplates(user: AuthUser, includeInactive = false) {
  const items = getRepository().listCertificateTemplates(user.organizationId, includeInactive);
  return items.map(templateToApi);
}

export function getTemplateById(id: number) {
  const template = getRepository().getCertificateTemplateById(id);
  return template ? templateToApi(template) : undefined;
}

export function getTemplateByClientId(clientId: number) {
  return getRepository().getCertificateTemplateByClientId(clientId);
}

export function createTemplate(input: CertificateTemplateInput, user: AuthUser) {
  const repo = getRepository();
  if (input.clientId) {
    const existing = repo.getCertificateTemplateByClientId(input.clientId);
    if (existing) {
      return templateToApi(existing);
    }
  }

  const now = new Date().toISOString();
  const id = repo.nextId('certificateTemplates');
  const template: CertificateTemplate = {
    id,
    organization_id: user.organizationId,
    name: input.name.trim(),
    description: input.description?.trim() ?? null,
    certificate_type: (input.certificateType ?? 'achievement') as CertificateType,
    template_url: input.templateUrl ?? null,
    is_active: input.isActive === false ? 0 : 1,
    created_by: user.id,
    client_id: input.clientId ?? null,
    created_at: now,
    updated_at: now,
  };
  repo.insertCertificateTemplate(template);
  logAudit('certificate_template', id, 'create', { name: template.name }, user.id, user.organizationId);
  return templateToApi(template);
}

export function updateTemplate(id: number, input: Partial<CertificateTemplateInput>, user: AuthUser) {
  const repo = getRepository();
  const existing = repo.getCertificateTemplateById(id);
  if (!existing || existing.organization_id !== user.organizationId) {
    return undefined;
  }

  const updated: CertificateTemplate = {
    ...existing,
    name: input.name?.trim() ?? existing.name,
    description: input.description !== undefined ? (input.description?.trim() ?? null) : existing.description,
    certificate_type: (input.certificateType ?? existing.certificate_type) as CertificateType,
    template_url: input.templateUrl !== undefined ? input.templateUrl : existing.template_url,
    is_active: input.isActive !== undefined ? (input.isActive ? 1 : 0) : existing.is_active,
    updated_at: new Date().toISOString(),
  };
  repo.updateCertificateTemplate(updated);
  logAudit('certificate_template', id, 'update', { name: updated.name }, user.id, user.organizationId);
  return templateToApi(updated);
}

export function apiToTemplateInput(payload: Record<string, unknown>): CertificateTemplateInput {
  return {
    name: String(payload['name'] ?? ''),
    description: payload['description'] != null ? String(payload['description']) : null,
    certificateType: payload['certificateType'] as CertificateType | undefined,
    templateUrl: payload['templateUrl'] != null ? String(payload['templateUrl']) : null,
    isActive: payload['isActive'] !== undefined ? Boolean(payload['isActive']) : undefined,
    clientId: payload['clientId'] != null ? Number(payload['clientId']) : null,
  };
}

export function seedDefaultTemplates(): void {
  const repo = getRepository();
  if (repo.listCertificateTemplates(1, true).length > 0) {
    return;
  }
  const now = new Date().toISOString();
  const defaults = [
    { name: 'Academic Excellence', type: 'merit' as CertificateType },
    { name: 'Course Completion', type: 'completion' as CertificateType },
    { name: 'Sports Achievement', type: 'achievement' as CertificateType },
    { name: 'Perfect Attendance', type: 'participation' as CertificateType },
  ];
  for (const item of defaults) {
    const id = repo.nextId('certificateTemplates');
    repo.insertCertificateTemplate({
      id,
      organization_id: 1,
      name: item.name,
      description: `Default ${item.name} template`,
      certificate_type: item.type,
      template_url: null,
      is_active: 1,
      created_by: null,
      client_id: null,
      created_at: now,
      updated_at: now,
    });
  }
}
