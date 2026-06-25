import { getRepository } from '../db/database';
import { AuditLog } from '../types';

export function logAudit(
  entityType: string,
  entityId: number,
  action: string,
  changes: Record<string, unknown> | null,
  userId?: number,
  organizationId = 1
): void {
  const repo = getRepository();
  const id = repo.nextId('auditLogs');
  const log: AuditLog = {
    id,
    organization_id: organizationId,
    entity_type: entityType,
    entity_id: entityId,
    action,
    changes_json: changes ? JSON.stringify(changes) : null,
    user_id: userId ?? null,
    created_at: new Date().toISOString(),
  };
  repo.insertAuditLog(log);
}

export function listAuditLogs(entityType?: string, entityId?: number, limit = 50) {
  return getRepository()
    .listAuditLogs(entityType, entityId, limit)
    .map((log) => ({
      id: log.id,
      entityType: log.entity_type,
      entityId: log.entity_id,
      action: log.action,
      changes: log.changes_json ? JSON.parse(log.changes_json) : null,
      userId: log.user_id,
      createdAt: log.created_at,
    }));
}
