"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processSyncPush = processSyncPush;
exports.pullChanges = pullChanges;
const database_1 = require("../db/database");
const student_service_1 = require("./student.service");
const custom_field_service_1 = require("./custom-field.service");
const voice_entry_service_1 = require("./voice-entry.service");
const certificate_service_1 = require("./certificate.service");
const certificate_template_service_1 = require("./certificate-template.service");
const award_service_1 = require("./award.service");
const parent_entity_service_1 = require("./parent-entity.service");
const permission_service_1 = require("./permission.service");
const user_service_1 = require("./user.service");
const attendance_service_1 = require("./attendance.service");
const event_service_1 = require("./event.service");
const organization_service_1 = require("./organization.service");
const sync_scope_service_1 = require("./sync-scope.service");
function processSyncPush(items, userId) {
    const results = [];
    for (const item of items) {
        try {
            const result = processItem(item, userId);
            results.push(result);
        }
        catch (err) {
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
function processItem(item, userId) {
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
function processStudentSync(item, userId, base) {
    const payload = item.payload;
    if (item.operation === 'create') {
        const input = (0, student_service_1.apiToStudentInput)(payload);
        input.clientId = item.clientId ?? payload['id'];
        const existing = input.clientId ? (0, student_service_1.getStudentByClientId)(input.clientId) : undefined;
        if (existing) {
            return { ...base, serverId: existing.id, success: true };
        }
        const created = (0, student_service_1.createStudent)(input, userId);
        return { ...base, serverId: created.id, success: true };
    }
    if (item.operation === 'update') {
        const serverId = resolveStudentServerId(item, payload);
        if (!serverId) {
            return { ...base, success: false, error: 'Student not found for update' };
        }
        const input = (0, student_service_1.apiToStudentInput)(payload);
        const updated = (0, student_service_1.updateStudent)(serverId, input, userId);
        return { ...base, serverId: updated?.id, success: !!updated };
    }
    if (item.operation === 'delete') {
        const serverId = resolveStudentServerId(item, payload);
        if (!serverId) {
            return { ...base, success: true };
        }
        const ok = (0, student_service_1.deleteStudent)(serverId, userId);
        return { ...base, serverId, success: ok };
    }
    return { ...base, success: false, error: 'Unknown operation' };
}
function processGroupSync(item, base) {
    const payload = item.payload;
    if (item.operation === 'create') {
        const name = String(payload['name'] ?? '');
        const description = payload['description'] != null ? String(payload['description']) : undefined;
        const clientId = item.clientId ?? payload['id'];
        if (clientId) {
            const existing = (0, database_1.getRepository)().findGroupByClientId(clientId);
            if (existing) {
                return { ...base, serverId: existing.id, success: true };
            }
        }
        const created = (0, student_service_1.createGroup)(name, description, clientId);
        return { ...base, serverId: created.id, success: true };
    }
    if (item.operation === 'delete') {
        const id = Number(payload['id'] ?? payload['serverId']);
        if (!id) {
            return { ...base, success: false, error: 'Group id required' };
        }
        const ok = (0, student_service_1.deleteGroup)(id);
        return { ...base, serverId: id, success: ok };
    }
    return { ...base, success: false, error: 'Unknown group operation' };
}
function resolveStudentServerId(item, payload) {
    if (payload['serverId']) {
        return Number(payload['serverId']);
    }
    if (item.clientId) {
        const byClient = (0, student_service_1.getStudentByClientId)(item.clientId);
        if (byClient) {
            return byClient.id;
        }
    }
    if (payload['id']) {
        const byId = (0, student_service_1.getStudentById)(Number(payload['id']));
        if (byId) {
            return byId.id;
        }
    }
    return undefined;
}
function pullChanges(user, since) {
    const repo = (0, database_1.getRepository)();
    const sinceDate = since ? new Date(since) : new Date(0);
    const sinceIso = sinceDate.toISOString();
    const orgId = user.organizationId;
    const students = (0, sync_scope_service_1.filterStudentsByScope)(repo.listStudentsUpdatedSince(sinceDate).filter((s) => s.organization_id === orgId), user);
    const groups = (0, sync_scope_service_1.filterGroupsByScope)(repo.listGroupsCreatedSince(sinceDate).filter((g) => g.organization_id === orgId), user);
    const events = (0, sync_scope_service_1.filterEventsByScope)(repo.listEventsUpdatedSince(sinceDate, orgId), user);
    const eventParticipants = events.flatMap((event) => repo.listEventParticipants(event.id).map((p) => ({
        id: p.id,
        eventId: p.event_id,
        studentId: p.student_id,
        registrationStatus: p.registration_status,
    })));
    const attendanceRecords = (0, sync_scope_service_1.filterAttendanceByScope)(repo.listAttendanceUpdatedSince(sinceDate, orgId), user).map((record) => ({
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
        .map(custom_field_service_1.definitionToApi);
    const customFieldValues = repo
        .listCustomFieldValuesUpdatedSince(sinceDate, orgId)
        .map((v) => {
        const def = repo.getCustomFieldDefinitionById(v.field_definition_id);
        return (0, custom_field_service_1.valueToApi)(v, def);
    });
    const voiceEntries = (0, sync_scope_service_1.filterVoiceByScope)(repo.listVoiceEntriesUpdatedSince(sinceDate, orgId), user).map((e) => (0, voice_entry_service_1.voiceEntryToApi)(e, true));
    const certificateTemplates = repo
        .listCertificateTemplatesUpdatedSince(sinceDate, orgId)
        .map(certificate_template_service_1.templateToApi);
    const certificates = (0, sync_scope_service_1.filterCertificatesByScope)(repo.listCertificatesUpdatedSince(sinceDate, orgId), user).map(certificate_service_1.certificateToApi);
    const awards = (0, sync_scope_service_1.filterAwardsByScope)(repo.listAwardsUpdatedSince(sinceDate, orgId), user).map(award_service_1.awardToApi);
    const parents = repo.listParentsUpdatedSince(sinceDate, orgId).map(parent_entity_service_1.parentToApi);
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
        .map(parent_entity_service_1.notificationPreferencesToApi);
    const studentScope = (0, sync_scope_service_1.getScopedStudentIds)(user);
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
    const org = (0, organization_service_1.getCurrentOrganization)();
    const organizations = org.updated_at >= sinceIso ? [(0, organization_service_1.organizationToApi)(org)] : [];
    const pulledAt = new Date().toISOString();
    return {
        since: since ?? null,
        entities: {
            students: students.map((s) => (0, student_service_1.studentToApi)(s)),
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
        students: students.map((s) => (0, student_service_1.studentToApi)(s)),
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
        stats: (0, student_service_1.getDashboardStats)(),
        pulledAt,
    };
}
function processCustomFieldDefinitionSync(item, userId, base) {
    const payload = item.payload;
    if (item.operation === 'create') {
        try {
            const created = (0, custom_field_service_1.createDefinition)({ ...payload, clientId: item.clientId }, userId);
            return { ...base, serverId: created.id, success: true };
        }
        catch (err) {
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
        const updated = (0, custom_field_service_1.updateDefinition)(serverId, payload, userId);
        return { ...base, serverId: updated?.id, success: !!updated };
    }
    if (item.operation === 'delete') {
        const serverId = Number(payload.serverId ?? payload.id ?? item.entityId);
        if (!serverId) {
            return { ...base, success: true };
        }
        const ok = (0, custom_field_service_1.deleteDefinition)(serverId, userId);
        return { ...base, serverId, success: ok };
    }
    return { ...base, success: false, error: 'Unknown custom field definition operation' };
}
function processCustomFieldValueSync(item, userId, base) {
    const payload = item.payload;
    if (item.operation === 'create' || item.operation === 'update') {
        const entityType = payload.entityType ?? 'student';
        const entityId = Number(payload.entityId);
        if (!entityId || !payload.values?.length) {
            return { ...base, success: false, error: 'entityId and values required' };
        }
        try {
            (0, custom_field_service_1.saveEntityValues)(entityType, entityId, payload.values, userId);
            return { ...base, serverId: entityId, success: true };
        }
        catch (err) {
            return {
                ...base,
                success: false,
                error: err instanceof Error ? err.message : 'Failed to sync custom field values',
            };
        }
    }
    return { ...base, success: false, error: 'Unknown custom field value operation' };
}
function processVoiceEntrySync(item, userId, base) {
    const user = userId ? (0, user_service_1.getUserById)(userId) : undefined;
    if (!user) {
        return { ...base, success: false, error: 'User required for voice entry sync' };
    }
    const authUser = (0, permission_service_1.buildAuthUser)(user);
    const payload = item.payload;
    const input = (0, voice_entry_service_1.apiToVoiceEntryInput)(payload);
    input.clientId = item.clientId ?? input.clientId;
    if (item.operation === 'create') {
        if (input.clientId) {
            const existing = (0, voice_entry_service_1.getVoiceEntryByClientId)(input.clientId);
            if (existing) {
                return { ...base, serverId: existing.id, success: true };
            }
        }
        try {
            const created = (0, voice_entry_service_1.createVoiceEntry)(input, authUser);
            return { ...base, serverId: created.id, success: true };
        }
        catch (err) {
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
            const updated = (0, voice_entry_service_1.updateVoiceEntry)(serverId, input, authUser);
            return { ...base, serverId: updated?.id, success: !!updated };
        }
        catch (err) {
            return {
                ...base,
                success: false,
                error: err instanceof Error ? err.message : 'Failed to sync voice entry update',
            };
        }
    }
    return { ...base, success: false, error: 'Unknown voice entry operation' };
}
function processCertificateTemplateSync(item, userId, base) {
    const user = userId ? (0, user_service_1.getUserById)(userId) : undefined;
    if (!user) {
        return { ...base, success: false, error: 'User required for template sync' };
    }
    const authUser = (0, permission_service_1.buildAuthUser)(user);
    const input = (0, certificate_template_service_1.apiToTemplateInput)(item.payload);
    input.clientId = item.clientId ?? input.clientId;
    if (item.operation === 'create') {
        if (input.clientId) {
            const existing = (0, certificate_template_service_1.getTemplateByClientId)(input.clientId);
            if (existing) {
                return { ...base, serverId: existing.id, success: true };
            }
        }
        try {
            const created = (0, certificate_template_service_1.createTemplate)(input, authUser);
            return { ...base, serverId: created.id, success: true };
        }
        catch (err) {
            return { ...base, success: false, error: err instanceof Error ? err.message : 'Template sync failed' };
        }
    }
    if (item.operation === 'update') {
        const serverId = Number(item.payload['serverId'] ?? item.payload['id'] ?? item.entityId);
        if (!serverId) {
            return { ...base, success: false, error: 'Template id required' };
        }
        const updated = (0, certificate_template_service_1.updateTemplate)(serverId, input, authUser);
        return { ...base, serverId: updated?.id, success: !!updated };
    }
    return { ...base, success: false, error: 'Unknown template operation' };
}
function processCertificateSync(item, userId, base) {
    const user = userId ? (0, user_service_1.getUserById)(userId) : undefined;
    if (!user) {
        return { ...base, success: false, error: 'User required for certificate sync' };
    }
    const authUser = (0, permission_service_1.buildAuthUser)(user);
    const input = (0, certificate_service_1.apiToCertificateInput)(item.payload);
    input.clientId = item.clientId ?? input.clientId;
    if (item.operation === 'create') {
        if (input.clientId) {
            const existing = (0, certificate_service_1.getCertificateByClientId)(input.clientId);
            if (existing) {
                return { ...base, serverId: existing.id, success: true };
            }
        }
        try {
            const created = (0, certificate_service_1.createCertificate)(input, authUser);
            return { ...base, serverId: created.id, success: true };
        }
        catch (err) {
            return { ...base, success: false, error: err instanceof Error ? err.message : 'Certificate sync failed' };
        }
    }
    if (item.operation === 'update') {
        const serverId = Number(item.payload['serverId'] ?? item.payload['id'] ?? item.entityId);
        if (!serverId) {
            return { ...base, success: false, error: 'Certificate id required' };
        }
        try {
            const updated = (0, certificate_service_1.updateCertificate)(serverId, input, authUser);
            return { ...base, serverId: updated?.id, success: !!updated };
        }
        catch (err) {
            return { ...base, success: false, error: err instanceof Error ? err.message : 'Certificate update sync failed' };
        }
    }
    return { ...base, success: false, error: 'Unknown certificate operation' };
}
function processAwardSync(item, userId, base) {
    const user = userId ? (0, user_service_1.getUserById)(userId) : undefined;
    if (!user) {
        return { ...base, success: false, error: 'User required for award sync' };
    }
    const authUser = (0, permission_service_1.buildAuthUser)(user);
    const input = (0, award_service_1.apiToAwardInput)(item.payload);
    input.clientId = item.clientId ?? input.clientId;
    if (item.operation === 'create') {
        if (input.clientId) {
            const existing = (0, award_service_1.getAwardByClientId)(input.clientId);
            if (existing) {
                return { ...base, serverId: existing.id, success: true };
            }
        }
        try {
            const created = (0, award_service_1.createAward)(input, authUser);
            return { ...base, serverId: created.id, success: true };
        }
        catch (err) {
            return { ...base, success: false, error: err instanceof Error ? err.message : 'Award sync failed' };
        }
    }
    if (item.operation === 'update') {
        const serverId = Number(item.payload['serverId'] ?? item.payload['id'] ?? item.entityId);
        if (!serverId) {
            return { ...base, success: false, error: 'Award id required' };
        }
        const updated = (0, award_service_1.updateAward)(serverId, input, authUser);
        return { ...base, serverId: updated?.id, success: !!updated };
    }
    return { ...base, success: false, error: 'Unknown award operation' };
}
function processAttendanceSync(item, userId, base) {
    if (!userId) {
        return { ...base, success: false, error: 'User required for attendance sync' };
    }
    const payload = item.payload;
    const input = {
        studentId: Number(payload['studentId']),
        groupId: payload['groupId'] != null ? Number(payload['groupId']) : undefined,
        eventId: payload['eventId'] != null ? Number(payload['eventId']) : undefined,
        attendanceDate: String(payload['attendanceDate'] ?? ''),
        contextType: payload['contextType'] ?? 'daily',
        periodNumber: payload['periodNumber'] != null ? Number(payload['periodNumber']) : undefined,
        status: payload['status'],
        remarks: payload['remarks'] != null ? String(payload['remarks']) : undefined,
        clientId: item.clientId ?? payload['clientId'],
    };
    if (item.operation === 'create' || item.operation === 'update') {
        if (item.operation === 'create' && input.clientId) {
            const existing = (0, database_1.getRepository)().getAttendanceByClientId(input.clientId);
            if (existing) {
                return { ...base, serverId: existing.id, success: true };
            }
        }
        if (item.operation === 'update') {
            const serverId = Number(payload['serverId'] ?? payload['id'] ?? item.entityId);
            if (!serverId) {
                return { ...base, success: false, error: 'Attendance id required for update' };
            }
            const updated = (0, attendance_service_1.updateAttendanceRecord)(serverId, input, userId);
            return { ...base, serverId: updated?.id, success: !!updated };
        }
        const record = (0, attendance_service_1.markAttendance)(input, userId);
        return { ...base, serverId: record.id, success: true };
    }
    return { ...base, success: false, error: 'Unknown attendance operation' };
}
function processEventSync(item, userId, base) {
    if (!userId) {
        return { ...base, success: false, error: 'User required for event sync' };
    }
    const payload = item.payload;
    const input = {
        title: String(payload['title'] ?? ''),
        description: payload['description'] != null ? String(payload['description']) : undefined,
        eventType: payload['eventType'] != null ? String(payload['eventType']) : undefined,
        startDate: String(payload['startDate'] ?? ''),
        endDate: payload['endDate'] != null ? String(payload['endDate']) : undefined,
        location: payload['location'] != null ? String(payload['location']) : undefined,
        groupId: payload['groupId'] != null ? Number(payload['groupId']) : undefined,
        status: payload['status'] != null ? String(payload['status']) : undefined,
        clientId: item.clientId ?? payload['clientId'],
    };
    if (item.operation === 'create') {
        if (input.clientId) {
            const existing = (0, database_1.getRepository)().getEventByClientId(input.clientId);
            if (existing) {
                return { ...base, serverId: existing.id, success: true };
            }
        }
        const created = (0, event_service_1.createEvent)(input, userId);
        return { ...base, serverId: created.id, success: true };
    }
    if (item.operation === 'update') {
        const serverId = Number(payload['serverId'] ?? payload['id'] ?? item.entityId);
        if (!serverId) {
            return { ...base, success: false, error: 'Event id required for update' };
        }
        const updated = (0, event_service_1.updateEvent)(serverId, input);
        return { ...base, serverId: updated?.id, success: !!updated };
    }
    if (item.operation === 'delete') {
        const serverId = Number(payload['serverId'] ?? payload['id'] ?? item.entityId);
        if (!serverId) {
            return { ...base, success: true };
        }
        return { ...base, serverId, success: (0, event_service_1.deleteEvent)(serverId) };
    }
    return { ...base, success: false, error: 'Unknown event operation' };
}
function processEventParticipantSync(item, base) {
    const payload = item.payload;
    const eventId = Number(payload['eventId'] ?? payload['serverEventId']);
    const studentId = Number(payload['studentId']);
    if (!eventId || !studentId) {
        return { ...base, success: false, error: 'eventId and studentId required' };
    }
    const repo = (0, database_1.getRepository)();
    if (item.operation === 'create') {
        (0, event_service_1.addEventParticipants)(eventId, [studentId]);
        return { ...base, serverId: eventId, success: true };
    }
    if (item.operation === 'delete') {
        const ok = repo.removeEventParticipant(eventId, studentId);
        return { ...base, serverId: eventId, success: ok };
    }
    return { ...base, success: false, error: 'Unknown event participant operation' };
}
