import { getRepository } from '../db/database';
import {
  AuthUser,
  VoiceEntry,
  VoiceEntryEdit,
  VoiceEntryFilters,
  VoiceEntryInput,
  VoiceEntryStatus,
} from '../types';
import { logAudit } from './audit.service';
import { canAccessStudent, getPermissionScope } from './permission.service';
import { getUserById } from './user.service';

function parseProcessedJson(json: string | null): Record<string, unknown> | null {
  if (!json) {
    return null;
  }
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function serializeProcessedJson(data: Record<string, unknown> | null | undefined): string | null {
  if (!data) {
    return null;
  }
  return JSON.stringify(data);
}

export function voiceEntryToApi(entry: VoiceEntry, includeDetails = true) {
  const repo = getRepository();
  const student = entry.student_id ? repo.getStudentById(entry.student_id) : undefined;
  const creator = entry.created_by ? getUserById(entry.created_by) : undefined;

  const base = {
    id: entry.id,
    organizationId: entry.organization_id,
    studentId: entry.student_id,
    studentName: student?.name ?? null,
    entityType: entry.entity_type,
    entityId: entry.entity_id,
    moduleCode: entry.module_code,
    transcript: includeDetails ? entry.transcript : entry.transcript.slice(0, 200),
    transcriptPreview: entry.transcript.slice(0, 120),
    processedJson: includeDetails ? parseProcessedJson(entry.processed_json) : null,
    audioUrl: entry.audio_url,
    speechEngine: entry.speech_engine,
    status: entry.status as VoiceEntryStatus,
    createdBy: entry.created_by,
    createdByName: creator?.name ?? null,
    clientId: entry.client_id,
    createdAt: entry.created_at,
    modifiedAt: entry.modified_at,
  };

  return base;
}

export function editToApi(edit: VoiceEntryEdit) {
  const editor = edit.edited_by ? getUserById(edit.edited_by) : undefined;
  return {
    id: edit.id,
    voiceEntryId: edit.voice_entry_id,
    fieldName: edit.field_name,
    oldValue: edit.old_value,
    newValue: edit.new_value,
    editedBy: edit.edited_by,
    editedByName: editor?.name ?? null,
    editedAt: edit.edited_at,
  };
}

function canAccessVoiceEntry(user: AuthUser, entry: VoiceEntry): boolean {
  const scope = getPermissionScope(user, 'voice', 'view');
  if (!scope) {
    return false;
  }

  switch (scope) {
    case 'all':
      return entry.organization_id === user.organizationId;
    case 'self':
      if (entry.created_by === user.id) {
        return true;
      }
      return entry.student_id != null && user.linkedStudentIds.includes(entry.student_id);
    case 'children':
      return entry.student_id != null && user.linkedStudentIds.includes(entry.student_id);
    case 'assigned_groups':
      return entry.student_id != null && canAccessStudent(user, entry.student_id);
    default:
      return false;
  }
}

function applyVoiceScopeFilters(user: AuthUser, filters: VoiceEntryFilters): VoiceEntryFilters {
  const scope = getPermissionScope(user, 'voice', 'view');
  if (!scope || scope === 'all') {
    return { ...filters, organizationId: user.organizationId };
  }

  if (scope === 'self') {
    if (filters.studentId !== undefined && !user.linkedStudentIds.includes(filters.studentId)) {
      if (filters.studentId !== user.linkedStudentIds[0]) {
        return { ...filters, organizationId: user.organizationId, studentId: -1 };
      }
    }
    return { ...filters, organizationId: user.organizationId };
  }

  if (scope === 'children') {
    const studentId = filters.studentId;
    if (studentId !== undefined && !user.linkedStudentIds.includes(studentId)) {
      return { ...filters, organizationId: user.organizationId, studentId: -1 };
    }
    return { ...filters, organizationId: user.organizationId };
  }

  return { ...filters, organizationId: user.organizationId };
}

function filterEntriesByScope(user: AuthUser, entries: VoiceEntry[]): VoiceEntry[] {
  return entries.filter((e) => canAccessVoiceEntry(user, e));
}

export function listVoiceEntries(user: AuthUser, filters: VoiceEntryFilters = {}) {
  const repo = getRepository();
  const scoped = applyVoiceScopeFilters(user, filters);
  let entries = repo.listVoiceEntries(scoped);

  const scope = getPermissionScope(user, 'voice', 'view');
  if (scope === 'self' && !scoped.studentId) {
    entries = entries.filter(
      (e) =>
        e.created_by === user.id
        || (e.student_id != null && user.linkedStudentIds.includes(e.student_id))
    );
  } else if (scope === 'children' && !scoped.studentId) {
    const childIds = new Set(user.linkedStudentIds);
    entries = entries.filter((e) => e.student_id != null && childIds.has(e.student_id));
  } else if (scope === 'assigned_groups') {
    entries = filterEntriesByScope(user, entries);
  }

  const total = entries.length;
  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? 100;
  const page = entries.slice(offset, offset + limit);

  return {
    items: page.map((e) => voiceEntryToApi(e, false)),
    total,
    limit,
    offset,
  };
}

export function getVoiceEntryById(user: AuthUser, id: number) {
  const repo = getRepository();
  const entry = repo.getVoiceEntryById(id);
  if (!entry) {
    return undefined;
  }
  if (!canAccessVoiceEntry(user, entry)) {
    return undefined;
  }
  return voiceEntryToApi(entry, true);
}

export function getVoiceEntryEdits(user: AuthUser, voiceEntryId: number) {
  const repo = getRepository();
  const entry = repo.getVoiceEntryById(voiceEntryId);
  if (!entry || !canAccessVoiceEntry(user, entry)) {
    return undefined;
  }
  return repo.listVoiceEntryEdits(voiceEntryId).map(editToApi);
}

export function listVoiceEntriesForStudent(user: AuthUser, studentId: number, limit = 20) {
  if (!canAccessStudent(user, studentId)) {
    return [];
  }
  const repo = getRepository();
  const entries = repo.listVoiceEntries({
    organizationId: user.organizationId,
    studentId,
    limit,
  });
  return filterEntriesByScope(user, entries).map((e) => voiceEntryToApi(e, false));
}

export function getVoiceEntryByClientId(clientId: number) {
  return getRepository().getVoiceEntryByClientId(clientId);
}

export function createVoiceEntry(input: VoiceEntryInput, user: AuthUser) {
  const repo = getRepository();

  if (input.studentId != null && !canAccessStudent(user, input.studentId)) {
    throw new Error('Not authorized to create voice entry for this student');
  }

  if (input.clientId) {
    const existing = repo.getVoiceEntryByClientId(input.clientId);
    if (existing) {
      return voiceEntryToApi(existing, true);
    }
  }

  const now = new Date().toISOString();
  const id = repo.nextId('voiceEntries');
  const status: VoiceEntryStatus =
    input.status ?? (input.processedJson ? 'processed' : 'draft');

  const entry: VoiceEntry = {
    id,
    organization_id: user.organizationId,
    student_id: input.studentId ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    module_code: input.moduleCode,
    transcript: input.transcript,
    processed_json: serializeProcessedJson(input.processedJson),
    audio_url: input.audioUrl ?? null,
    speech_engine: input.speechEngine ?? null,
    status,
    created_by: user.id,
    client_id: input.clientId ?? null,
    created_at: now,
    modified_at: now,
  };

  repo.insertVoiceEntry(entry);
  logAudit('voice_entry', id, 'create', {
    moduleCode: input.moduleCode,
    studentId: input.studentId,
    status,
  }, user.id, user.organizationId);

  return voiceEntryToApi(entry, true);
}

export function updateVoiceEntry(
  id: number,
  input: Partial<VoiceEntryInput>,
  user: AuthUser
) {
  const repo = getRepository();
  const existing = repo.getVoiceEntryById(id);
  if (!existing) {
    return undefined;
  }
  if (!canAccessVoiceEntry(user, existing)) {
    throw new Error('Not authorized to update this voice entry');
  }

  if (input.studentId != null && !canAccessStudent(user, input.studentId)) {
    throw new Error('Not authorized to link voice entry to this student');
  }

  const now = new Date().toISOString();
  const oldProcessed = parseProcessedJson(existing.processed_json) ?? {};
  const newProcessed =
    input.processedJson !== undefined
      ? (input.processedJson ?? {})
      : oldProcessed;

  if (input.processedJson !== undefined) {
    recordProcessedJsonEdits(id, oldProcessed, newProcessed, user.id, now);
  }

  const updated: VoiceEntry = {
    ...existing,
    student_id: input.studentId !== undefined ? input.studentId : existing.student_id,
    entity_type: input.entityType !== undefined ? input.entityType : existing.entity_type,
    entity_id: input.entityId !== undefined ? input.entityId : existing.entity_id,
    module_code: input.moduleCode ?? existing.module_code,
    transcript: input.transcript ?? existing.transcript,
    processed_json:
      input.processedJson !== undefined
        ? serializeProcessedJson(input.processedJson)
        : existing.processed_json,
    audio_url: input.audioUrl !== undefined ? input.audioUrl : existing.audio_url,
    speech_engine: input.speechEngine !== undefined ? input.speechEngine : existing.speech_engine,
    status: input.status ?? existing.status,
    modified_at: now,
  };

  repo.updateVoiceEntry(updated);
  logAudit('voice_entry', id, 'update', {
    studentId: updated.student_id,
    status: updated.status,
    entityType: updated.entity_type,
    entityId: updated.entity_id,
  }, user.id, user.organizationId);

  return voiceEntryToApi(updated, true);
}

function recordProcessedJsonEdits(
  voiceEntryId: number,
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  userId: number,
  editedAt: string
): void {
  const repo = getRepository();
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

  for (const key of allKeys) {
    const oldVal = oldData[key];
    const newVal = newData[key];
    const oldStr = oldVal === undefined ? null : JSON.stringify(oldVal);
    const newStr = newVal === undefined ? null : JSON.stringify(newVal);

    if (oldStr === newStr) {
      continue;
    }

    const editId = repo.nextId('voiceEntryEdits');
    const edit: VoiceEntryEdit = {
      id: editId,
      voice_entry_id: voiceEntryId,
      field_name: key,
      old_value: oldStr,
      new_value: newStr,
      edited_by: userId,
      edited_at: editedAt,
    };
    repo.insertVoiceEntryEdit(edit);
  }
}

export function getVoiceEntryStats(user: AuthUser) {
  const repo = getRepository();
  const entries = filterEntriesByScope(
    user,
    repo.listVoiceEntries({ organizationId: user.organizationId, limit: 10000 })
  );

  const byStatus: Record<string, number> = {};
  const byModule: Record<string, number> = {};
  const byEngine: Record<string, number> = {};
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  let recentCount = 0;

  for (const entry of entries) {
    byStatus[entry.status] = (byStatus[entry.status] ?? 0) + 1;
    byModule[entry.module_code] = (byModule[entry.module_code] ?? 0) + 1;
    const engine = entry.speech_engine ?? 'unknown';
    byEngine[engine] = (byEngine[engine] ?? 0) + 1;
    if (new Date(entry.created_at) >= thirtyDaysAgo) {
      recentCount += 1;
    }
  }

  return {
    total: entries.length,
    recent30Days: recentCount,
    byStatus,
    byModule,
    bySpeechEngine: byEngine,
  };
}

export function apiToVoiceEntryInput(payload: Record<string, unknown>): VoiceEntryInput {
  return {
    studentId: payload['studentId'] != null ? Number(payload['studentId']) : null,
    entityType: payload['entityType'] != null ? String(payload['entityType']) : null,
    entityId: payload['entityId'] != null ? Number(payload['entityId']) : null,
    moduleCode: String(payload['moduleCode'] ?? 'student'),
    transcript: String(payload['transcript'] ?? ''),
    processedJson: payload['processedJson'] as Record<string, unknown> | null | undefined,
    audioUrl: payload['audioUrl'] != null ? String(payload['audioUrl']) : null,
    speechEngine: payload['speechEngine'] != null ? String(payload['speechEngine']) : null,
    status: payload['status'] as VoiceEntryStatus | undefined,
    clientId: payload['clientId'] != null ? Number(payload['clientId']) : null,
  };
}
