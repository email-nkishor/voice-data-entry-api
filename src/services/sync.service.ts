import {
  apiToStudentInput,
  createStudent,
  deleteStudent,
  getStudentByClientId,
  getStudentById,
  updateStudent,
  createGroup,
  deleteGroup,
  getDashboardStats,
  studentToApi,
} from './student.service';
import { getRepository } from '../db/database';
import { SyncPushItem } from '../types';

export interface SyncPushResult {
  queueId?: number;
  entity: string;
  operation: string;
  clientId?: number;
  serverId?: number;
  success: boolean;
  error?: string;
}

export function processSyncPush(
  items: SyncPushItem[],
  userId?: number
): SyncPushResult[] {
  const results: SyncPushResult[] = [];

  for (const item of items) {
    try {
      const result = processItem(item, userId);
      results.push(result);
    } catch (err) {
      results.push({
        queueId: item.queueId,
        entity: item.entity,
        operation: item.operation,
        clientId: item.clientId,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return results;
}

function processItem(item: SyncPushItem, userId?: number): SyncPushResult {
  const base = {
    queueId: item.queueId,
    entity: item.entity,
    operation: item.operation,
    clientId: item.clientId,
  };

  if (item.entity === 'student') {
    return processStudentSync(item, userId, base);
  }

  if (item.entity === 'studentGroup') {
    return processGroupSync(item, base);
  }

  return { ...base, success: false, error: `Unsupported entity: ${item.entity}` };
}

function processStudentSync(
  item: SyncPushItem,
  userId: number | undefined,
  base: Omit<SyncPushResult, 'success' | 'serverId' | 'error'>
): SyncPushResult {
  const payload = item.payload;

  if (item.operation === 'create') {
    const input = apiToStudentInput(payload);
    input.clientId = item.clientId ?? (payload['id'] as number | undefined);
    const existing = input.clientId ? getStudentByClientId(input.clientId) : undefined;
    if (existing) {
      return { ...base, serverId: existing.id, success: true };
    }
    const created = createStudent(input, userId);
    return { ...base, serverId: created.id, success: true };
  }

  if (item.operation === 'update') {
    const serverId = resolveStudentServerId(item, payload);
    if (!serverId) {
      return { ...base, success: false, error: 'Student not found for update' };
    }
    const input = apiToStudentInput(payload);
    const updated = updateStudent(serverId, input, userId);
    return { ...base, serverId: updated?.id, success: !!updated };
  }

  if (item.operation === 'delete') {
    const serverId = resolveStudentServerId(item, payload);
    if (!serverId) {
      return { ...base, success: true };
    }
    const ok = deleteStudent(serverId, userId);
    return { ...base, serverId, success: ok };
  }

  return { ...base, success: false, error: 'Unknown operation' };
}

function processGroupSync(
  item: SyncPushItem,
  base: Omit<SyncPushResult, 'success' | 'serverId' | 'error'>
): SyncPushResult {
  const payload = item.payload;

  if (item.operation === 'create') {
    const name = String(payload['name'] ?? '');
    const description = payload['description'] != null ? String(payload['description']) : undefined;
    const clientId = item.clientId ?? (payload['id'] as number | undefined);
    const created = createGroup(name, description, clientId);
    return { ...base, serverId: created.id, success: true };
  }

  if (item.operation === 'delete') {
    const id = Number(payload['id'] ?? payload['serverId']);
    if (!id) {
      return { ...base, success: false, error: 'Group id required' };
    }
    const ok = deleteGroup(id);
    return { ...base, serverId: id, success: ok };
  }

  return { ...base, success: false, error: 'Unknown group operation' };
}

function resolveStudentServerId(
  item: SyncPushItem,
  payload: Record<string, unknown>
): number | undefined {
  if (payload['serverId']) {
    return Number(payload['serverId']);
  }
  if (item.clientId) {
    const byClient = getStudentByClientId(item.clientId);
    if (byClient) {
      return byClient.id;
    }
  }
  if (payload['id']) {
    const byId = getStudentById(Number(payload['id']));
    if (byId) {
      return byId.id;
    }
  }
  return undefined;
}

export function pullChanges(since?: string) {
  const repo = getRepository();
  const sinceDate = since ? new Date(since) : new Date(0);
  const students = repo.listStudentsUpdatedSince(sinceDate);
  const groups = repo.listGroupsCreatedSince(sinceDate);

  return {
    students: students.map(studentToApi),
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      isDefault: !!g.is_default,
      clientId: g.client_id,
      createdDate: g.created_at,
    })),
    stats: getDashboardStats(),
    pulledAt: new Date().toISOString(),
  };
}
