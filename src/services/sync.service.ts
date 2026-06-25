import { getRepository } from '../db/database';
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
import {
  createDefinition,
  definitionToApi,
  getEntityValues,
  saveEntityValues,
  updateDefinition,
  deleteDefinition,
  valueToApi,
} from './custom-field.service';
import { CustomFieldDefinitionInput, CustomFieldValueInput, SyncPushItem } from '../types';
import {
  apiToVoiceEntryInput,
  createVoiceEntry,
  getVoiceEntryByClientId,
  updateVoiceEntry,
  voiceEntryToApi,
} from './voice-entry.service';
import {
  apiToCertificateInput,
  createCertificate,
  getCertificateByClientId,
  updateCertificate,
  certificateToApi,
} from './certificate.service';
import {
  apiToTemplateInput,
  createTemplate,
  getTemplateByClientId,
  updateTemplate,
  templateToApi,
} from './certificate-template.service';
import {
  apiToAwardInput,
  createAward,
  getAwardByClientId,
  updateAward,
  awardToApi,
} from './award.service';
import { parentToApi, notificationPreferencesToApi } from './parent-entity.service';
import { buildAuthUser } from './permission.service';
import { getUserById } from './user.service';
import {
  markAttendance,
  updateAttendanceRecord,
  AttendanceInput,
} from './attendance.service';
import {
  createEvent,
  updateEvent,
  deleteEvent,
  addEventParticipants,
  EventInput,
} from './event.service';
import { getCurrentOrganization, organizationToApi } from './organization.service';
import {
  filterAttendanceByScope,
  filterAwardsByScope,
  filterCertificatesByScope,
  filterEventsByScope,
  filterGroupsByScope,
  filterStudentsByScope,
  filterVoiceByScope,
  getScopedStudentIds,
} from './sync-scope.service';
import { AuthUser, AttendanceContextType, AttendanceStatus } from '../types';

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

  if (item.entity === 'customFieldDefinition') {
    return processCustomFieldDefinitionSync(item, userId, base);
  }

  if (item.entity === 'customFieldValue') {
    return processCustomFieldValueSync(item, userId, base);
  }

  if (item.entity === 'voiceEntry') {
    return processVoiceEntrySync(item, userId, base);
  }

  if (item.entity === 'certificateTemplate') {
    return processCertificateTemplateSync(item, userId, base);
  }

  if (item.entity === 'certificate') {
    return processCertificateSync(item, userId, base);
  }

  if (item.entity === 'award') {
    return processAwardSync(item, userId, base);
  }

  if (item.entity === 'attendance') {
    return processAttendanceSync(item, userId, base);
  }

  if (item.entity === 'event') {
    return processEventSync(item, userId, base);
  }

  if (item.entity === 'eventParticipant') {
    return processEventParticipantSync(item, base);
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
    if (clientId) {
      const existing = getRepository().findGroupByClientId(clientId);
      if (existing) {
        return { ...base, serverId: existing.id, success: true };
      }
    }
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

export function pullChanges(user: AuthUser, since?: string) {
  const repo = getRepository();
  const sinceDate = since ? new Date(since) : new Date(0);
  const sinceIso = sinceDate.toISOString();
  const orgId = user.organizationId;

  const students = filterStudentsByScope(
    repo.listStudentsUpdatedSince(sinceDate).filter((s) => s.organization_id === orgId),
    user
  );
  const groups = filterGroupsByScope(
    repo.listGroupsCreatedSince(sinceDate).filter((g) => g.organization_id === orgId),
    user
  );
  const events = filterEventsByScope(
    repo.listEventsUpdatedSince(sinceDate, orgId),
    user
  );
  const eventParticipants = events.flatMap((event) =>
    repo.listEventParticipants(event.id).map((p) => ({
      id: p.id,
      eventId: p.event_id,
      studentId: p.student_id,
      registrationStatus: p.registration_status,
    }))
  );

  const attendanceRecords = filterAttendanceByScope(
    repo.listAttendanceUpdatedSince(sinceDate, orgId),
    user
  ).map((record) => ({
    id: record.id,
    studentId: record.student_id,
    groupId: record.group_id,
    eventId: record.event_id,
    attendanceDate: record.attendance_date,
    contextType: record.context_type,
    periodNumber: record.period_number,
    status: record.status,
    remarks: record.remarks,
    markedBy: record.marked_by,
    clientId: record.client_id,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }));

  const customFieldDefinitions = repo
    .listCustomFieldDefinitionsUpdatedSince(sinceDate, orgId)
    .map(definitionToApi);
  const customFieldValues = repo
    .listCustomFieldValuesUpdatedSince(sinceDate, orgId)
    .map((v) => {
      const def = repo.getCustomFieldDefinitionById(v.field_definition_id);
      return valueToApi(v, def);
    });
  const voiceEntries = filterVoiceByScope(
    repo.listVoiceEntriesUpdatedSince(sinceDate, orgId),
    user
  ).map((e) => voiceEntryToApi(e, true));
  const certificateTemplates = repo
    .listCertificateTemplatesUpdatedSince(sinceDate, orgId)
    .map(templateToApi);
  const certificates = filterCertificatesByScope(
    repo.listCertificatesUpdatedSince(sinceDate, orgId),
    user
  ).map(certificateToApi);
  const awards = filterAwardsByScope(
    repo.listAwardsUpdatedSince(sinceDate, orgId),
    user
  ).map(awardToApi);

  const parents = repo.listParentsUpdatedSince(sinceDate, orgId).map(parentToApi);
  const parentStudentMappings = repo.listParentMappingsUpdatedSince(sinceDate, orgId).map((m) => ({
    id: m.id,
    parentId: m.parent_id,
    studentId: m.student_id,
    relationshipType: m.relationship_type,
    isPrimaryContact: m.is_primary_contact === 1,
    organizationId: m.organization_id,
    createdAt: m.created_at,
  }));
  const parentNotificationPreferences = repo
    .listParentNotificationPreferencesUpdatedSince(sinceDate, orgId)
    .map(notificationPreferencesToApi);

  const studentScope = getScopedStudentIds(user);
  const userStudentLinks = repo
    .listUserStudentLinksUpdatedSince(sinceDate, orgId)
    .filter((link) => studentScope === 'all' || studentScope.includes(link.student_id))
    .map((link) => ({
      id: link.id,
      userId: link.user_id,
      studentId: link.student_id,
      relationship: link.relationship,
      isPrimary: link.is_primary === 1,
      createdAt: link.created_at,
    }));

  const org = getCurrentOrganization();
  const organizations =
    org.updated_at >= sinceIso ? [organizationToApi(org)] : [];

  const pulledAt = new Date().toISOString();

  return {
    since: since ?? null,
    entities: {
      students: students.map((s) => studentToApi(s)),
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        isDefault: !!g.is_default,
        clientId: g.client_id,
        createdDate: g.created_at,
      })),
      attendance: attendanceRecords,
      events: events.map((event) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        eventType: event.event_type,
        startDate: event.start_date,
        endDate: event.end_date,
        location: event.location,
        groupId: event.group_id,
        createdBy: event.created_by,
        status: event.status,
        clientId: event.client_id,
        createdAt: event.created_at,
        updatedAt: event.updated_at,
      })),
      eventParticipants,
      customFieldDefinitions,
      customFieldValues,
      voiceEntries,
      certificateTemplates,
      certificates,
      awards,
      parents,
      parentStudentMappings,
      parentNotificationPreferences,
      userStudentLinks,
      organizations,
    },
    students: students.map((s) => studentToApi(s)),
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      isDefault: !!g.is_default,
      clientId: g.client_id,
      createdDate: g.created_at,
    })),
    customFieldDefinitions,
    customFieldValues,
    voiceEntries,
    certificateTemplates,
    certificates,
    awards,
    parents,
    parentStudentMappings,
    parentNotificationPreferences,
    attendanceRecords,
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      eventType: event.event_type,
      startDate: event.start_date,
      endDate: event.end_date,
      location: event.location,
      groupId: event.group_id,
      createdBy: event.created_by,
      status: event.status,
      clientId: event.client_id,
      createdAt: event.created_at,
      updatedAt: event.updated_at,
    })),
    eventParticipants,
    userStudentLinks,
    organizations,
    stats: getDashboardStats(),
    pulledAt,
  };
}

function processCustomFieldDefinitionSync(
  item: SyncPushItem,
  userId: number | undefined,
  base: Omit<SyncPushResult, 'success' | 'serverId' | 'error'>
): SyncPushResult {
  const payload = item.payload as unknown as CustomFieldDefinitionInput & {
    id?: number;
    serverId?: number;
  };

  if (item.operation === 'create') {
    try {
      const created = createDefinition({ ...payload, clientId: item.clientId }, userId);
      return { ...base, serverId: created.id, success: true };
    } catch (err) {
      return {
        ...base,
        success: false,
        error: err instanceof Error ? err.message : 'Failed to sync custom field definition',
      };
    }
  }

  if (item.operation === 'update') {
    const serverId = Number(payload.serverId ?? payload.id ?? item.entityId);
    if (!serverId) {
      return { ...base, success: false, error: 'Definition id required for update' };
    }
    const updated = updateDefinition(serverId, payload, userId);
    return { ...base, serverId: updated?.id, success: !!updated };
  }

  if (item.operation === 'delete') {
    const serverId = Number(payload.serverId ?? payload.id ?? item.entityId);
    if (!serverId) {
      return { ...base, success: true };
    }
    const ok = deleteDefinition(serverId, userId);
    return { ...base, serverId, success: ok };
  }

  return { ...base, success: false, error: 'Unknown custom field definition operation' };
}

function processCustomFieldValueSync(
  item: SyncPushItem,
  userId: number | undefined,
  base: Omit<SyncPushResult, 'success' | 'serverId' | 'error'>
): SyncPushResult {
  const payload = item.payload as {
    entityType?: string;
    entityId?: number;
    values?: CustomFieldValueInput[];
  };

  if (item.operation === 'create' || item.operation === 'update') {
    const entityType = payload.entityType ?? 'student';
    const entityId = Number(payload.entityId);
    if (!entityId || !payload.values?.length) {
      return { ...base, success: false, error: 'entityId and values required' };
    }
    try {
      saveEntityValues(entityType, entityId, payload.values, userId);
      return { ...base, serverId: entityId, success: true };
    } catch (err) {
      return {
        ...base,
        success: false,
        error: err instanceof Error ? err.message : 'Failed to sync custom field values',
      };
    }
  }

  return { ...base, success: false, error: 'Unknown custom field value operation' };
}

function processVoiceEntrySync(
  item: SyncPushItem,
  userId: number | undefined,
  base: Omit<SyncPushResult, 'success' | 'serverId' | 'error'>
): SyncPushResult {
  const user = userId ? getUserById(userId) : undefined;
  if (!user) {
    return { ...base, success: false, error: 'User required for voice entry sync' };
  }
  const authUser = buildAuthUser(user);
  const payload = item.payload;
  const input = apiToVoiceEntryInput(payload);
  input.clientId = item.clientId ?? input.clientId;

  if (item.operation === 'create') {
    if (input.clientId) {
      const existing = getVoiceEntryByClientId(input.clientId);
      if (existing) {
        return { ...base, serverId: existing.id, success: true };
      }
    }
    try {
      const created = createVoiceEntry(input, authUser);
      return { ...base, serverId: created.id, success: true };
    } catch (err) {
      return {
        ...base,
        success: false,
        error: err instanceof Error ? err.message : 'Failed to sync voice entry',
      };
    }
  }

  if (item.operation === 'update') {
    const serverId = Number(payload['serverId'] ?? payload['id'] ?? item.entityId);
    if (!serverId) {
      return { ...base, success: false, error: 'Voice entry id required for update' };
    }
    try {
      const updated = updateVoiceEntry(serverId, input, authUser);
      return { ...base, serverId: updated?.id, success: !!updated };
    } catch (err) {
      return {
        ...base,
        success: false,
        error: err instanceof Error ? err.message : 'Failed to sync voice entry update',
      };
    }
  }

  return { ...base, success: false, error: 'Unknown voice entry operation' };
}

function processCertificateTemplateSync(
  item: SyncPushItem,
  userId: number | undefined,
  base: Omit<SyncPushResult, 'success' | 'serverId' | 'error'>
): SyncPushResult {
  const user = userId ? getUserById(userId) : undefined;
  if (!user) {
    return { ...base, success: false, error: 'User required for template sync' };
  }
  const authUser = buildAuthUser(user);
  const input = apiToTemplateInput(item.payload);
  input.clientId = item.clientId ?? input.clientId;

  if (item.operation === 'create') {
    if (input.clientId) {
      const existing = getTemplateByClientId(input.clientId);
      if (existing) {
        return { ...base, serverId: existing.id, success: true };
      }
    }
    try {
      const created = createTemplate(input, authUser);
      return { ...base, serverId: created.id, success: true };
    } catch (err) {
      return { ...base, success: false, error: err instanceof Error ? err.message : 'Template sync failed' };
    }
  }

  if (item.operation === 'update') {
    const serverId = Number(item.payload['serverId'] ?? item.payload['id'] ?? item.entityId);
    if (!serverId) {
      return { ...base, success: false, error: 'Template id required' };
    }
    const updated = updateTemplate(serverId, input, authUser);
    return { ...base, serverId: updated?.id, success: !!updated };
  }

  return { ...base, success: false, error: 'Unknown template operation' };
}

function processCertificateSync(
  item: SyncPushItem,
  userId: number | undefined,
  base: Omit<SyncPushResult, 'success' | 'serverId' | 'error'>
): SyncPushResult {
  const user = userId ? getUserById(userId) : undefined;
  if (!user) {
    return { ...base, success: false, error: 'User required for certificate sync' };
  }
  const authUser = buildAuthUser(user);
  const input = apiToCertificateInput(item.payload);
  input.clientId = item.clientId ?? input.clientId;

  if (item.operation === 'create') {
    if (input.clientId) {
      const existing = getCertificateByClientId(input.clientId);
      if (existing) {
        return { ...base, serverId: existing.id, success: true };
      }
    }
    try {
      const created = createCertificate(input, authUser);
      return { ...base, serverId: created.id, success: true };
    } catch (err) {
      return { ...base, success: false, error: err instanceof Error ? err.message : 'Certificate sync failed' };
    }
  }

  if (item.operation === 'update') {
    const serverId = Number(item.payload['serverId'] ?? item.payload['id'] ?? item.entityId);
    if (!serverId) {
      return { ...base, success: false, error: 'Certificate id required' };
    }
    try {
      const updated = updateCertificate(serverId, input, authUser);
      return { ...base, serverId: updated?.id, success: !!updated };
    } catch (err) {
      return { ...base, success: false, error: err instanceof Error ? err.message : 'Certificate update sync failed' };
    }
  }

  return { ...base, success: false, error: 'Unknown certificate operation' };
}

function processAwardSync(
  item: SyncPushItem,
  userId: number | undefined,
  base: Omit<SyncPushResult, 'success' | 'serverId' | 'error'>
): SyncPushResult {
  const user = userId ? getUserById(userId) : undefined;
  if (!user) {
    return { ...base, success: false, error: 'User required for award sync' };
  }
  const authUser = buildAuthUser(user);
  const input = apiToAwardInput(item.payload);
  input.clientId = item.clientId ?? input.clientId;

  if (item.operation === 'create') {
    if (input.clientId) {
      const existing = getAwardByClientId(input.clientId);
      if (existing) {
        return { ...base, serverId: existing.id, success: true };
      }
    }
    try {
      const created = createAward(input, authUser);
      return { ...base, serverId: created.id, success: true };
    } catch (err) {
      return { ...base, success: false, error: err instanceof Error ? err.message : 'Award sync failed' };
    }
  }

  if (item.operation === 'update') {
    const serverId = Number(item.payload['serverId'] ?? item.payload['id'] ?? item.entityId);
    if (!serverId) {
      return { ...base, success: false, error: 'Award id required' };
    }
    const updated = updateAward(serverId, input, authUser);
    return { ...base, serverId: updated?.id, success: !!updated };
  }

  return { ...base, success: false, error: 'Unknown award operation' };
}

function processAttendanceSync(
  item: SyncPushItem,
  userId: number | undefined,
  base: Omit<SyncPushResult, 'success' | 'serverId' | 'error'>
): SyncPushResult {
  if (!userId) {
    return { ...base, success: false, error: 'User required for attendance sync' };
  }

  const payload = item.payload;
  const input: AttendanceInput = {
    studentId: Number(payload['studentId']),
    groupId: payload['groupId'] != null ? Number(payload['groupId']) : undefined,
    eventId: payload['eventId'] != null ? Number(payload['eventId']) : undefined,
    attendanceDate: String(payload['attendanceDate'] ?? ''),
    contextType: (payload['contextType'] as AttendanceContextType) ?? 'daily',
    periodNumber: payload['periodNumber'] != null ? Number(payload['periodNumber']) : undefined,
    status: payload['status'] as AttendanceStatus,
    remarks: payload['remarks'] != null ? String(payload['remarks']) : undefined,
    clientId: item.clientId ?? (payload['clientId'] as number | undefined),
  };

  if (item.operation === 'create' || item.operation === 'update') {
    if (item.operation === 'create' && input.clientId) {
      const existing = getRepository().getAttendanceByClientId(input.clientId);
      if (existing) {
        return { ...base, serverId: existing.id, success: true };
      }
    }
    if (item.operation === 'update') {
      const serverId = Number(payload['serverId'] ?? payload['id'] ?? item.entityId);
      if (!serverId) {
        return { ...base, success: false, error: 'Attendance id required for update' };
      }
      const updated = updateAttendanceRecord(serverId, input, userId);
      return { ...base, serverId: updated?.id, success: !!updated };
    }
    const record = markAttendance(input, userId);
    return { ...base, serverId: record.id, success: true };
  }

  return { ...base, success: false, error: 'Unknown attendance operation' };
}

function processEventSync(
  item: SyncPushItem,
  userId: number | undefined,
  base: Omit<SyncPushResult, 'success' | 'serverId' | 'error'>
): SyncPushResult {
  if (!userId) {
    return { ...base, success: false, error: 'User required for event sync' };
  }

  const payload = item.payload;
  const input: EventInput = {
    title: String(payload['title'] ?? ''),
    description: payload['description'] != null ? String(payload['description']) : undefined,
    eventType: payload['eventType'] != null ? String(payload['eventType']) : undefined,
    startDate: String(payload['startDate'] ?? ''),
    endDate: payload['endDate'] != null ? String(payload['endDate']) : undefined,
    location: payload['location'] != null ? String(payload['location']) : undefined,
    groupId: payload['groupId'] != null ? Number(payload['groupId']) : undefined,
    status: payload['status'] != null ? String(payload['status']) : undefined,
    clientId: item.clientId ?? (payload['clientId'] as number | undefined),
  };

  if (item.operation === 'create') {
    if (input.clientId) {
      const existing = getRepository().getEventByClientId(input.clientId);
      if (existing) {
        return { ...base, serverId: existing.id, success: true };
      }
    }
    const created = createEvent(input, userId);
    return { ...base, serverId: created.id, success: true };
  }

  if (item.operation === 'update') {
    const serverId = Number(payload['serverId'] ?? payload['id'] ?? item.entityId);
    if (!serverId) {
      return { ...base, success: false, error: 'Event id required for update' };
    }
    const updated = updateEvent(serverId, input);
    return { ...base, serverId: updated?.id, success: !!updated };
  }

  if (item.operation === 'delete') {
    const serverId = Number(payload['serverId'] ?? payload['id'] ?? item.entityId);
    if (!serverId) {
      return { ...base, success: true };
    }
    return { ...base, serverId, success: deleteEvent(serverId) };
  }

  return { ...base, success: false, error: 'Unknown event operation' };
}

function processEventParticipantSync(
  item: SyncPushItem,
  base: Omit<SyncPushResult, 'success' | 'serverId' | 'error'>
): SyncPushResult {
  const payload = item.payload;
  const eventId = Number(payload['eventId'] ?? payload['serverEventId']);
  const studentId = Number(payload['studentId']);

  if (!eventId || !studentId) {
    return { ...base, success: false, error: 'eventId and studentId required' };
  }

  const repo = getRepository();
  if (item.operation === 'create') {
    addEventParticipants(eventId, [studentId]);
    return { ...base, serverId: eventId, success: true };
  }

  if (item.operation === 'delete') {
    const ok = repo.removeEventParticipant(eventId, studentId);
    return { ...base, serverId: eventId, success: ok };
  }

  return { ...base, success: false, error: 'Unknown event participant operation' };
}
