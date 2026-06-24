"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processSyncPush = processSyncPush;
exports.pullChanges = pullChanges;
const student_service_1 = require("./student.service");
const database_1 = require("../db/database");
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
function pullChanges(since) {
    const repo = (0, database_1.getRepository)();
    const sinceDate = since ? new Date(since) : new Date(0);
    const students = repo.listStudentsUpdatedSince(sinceDate);
    const groups = repo.listGroupsCreatedSince(sinceDate);
    return {
        students: students.map(student_service_1.studentToApi),
        groups: groups.map((g) => ({
            id: g.id,
            name: g.name,
            description: g.description,
            isDefault: !!g.is_default,
            clientId: g.client_id,
            createdDate: g.created_at,
        })),
        stats: (0, student_service_1.getDashboardStats)(),
        pulledAt: new Date().toISOString(),
    };
}
