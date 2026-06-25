"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonRepository = void 0;
exports.createJsonRepository = createJsonRepository;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const json_migrations_1 = require("./json-migrations");
const EMPTY_DB = {
    organizations: [],
    users: [],
    permissions: [],
    rolePermissions: [],
    userStudentLinks: [],
    parents: [],
    parentStudentMappings: [],
    parentNotificationPreferences: [],
    teacherGroupAssignments: [],
    studentGroups: [],
    groupStudents: [],
    students: [],
    studentActivities: [],
    events: [],
    eventParticipants: [],
    attendanceRecords: [],
    customFieldDefinitions: [],
    customFieldValues: [],
    auditLogs: [],
    certificateTemplates: [],
    certificates: [],
    awards: [],
    voiceEntries: [],
    voiceEntryEdits: [],
    lookups: {
        class: [],
        grade: [],
        section: [],
        status: [],
        feeStatus: [],
    },
    nextIds: {
        users: 1,
        studentGroups: 1,
        students: 1,
        studentActivities: 1,
        organizations: 1,
        permissions: 1,
        rolePermissions: 1,
        userStudentLinks: 1,
        parents: 1,
        parentStudentMappings: 1,
        parentNotificationPreferences: 1,
        groupStudents: 1,
        teacherGroupAssignments: 1,
        events: 1,
        eventParticipants: 1,
        attendanceRecords: 1,
        certificateTemplates: 1,
        certificates: 1,
        awards: 1,
        voiceEntries: 1,
        voiceEntryEdits: 1,
        customFieldDefinitions: 1,
        customFieldValues: 1,
        auditLogs: 1,
    },
};
class JsonRepository {
    filePath;
    driver = 'json';
    cache = null;
    constructor(filePath) {
        this.filePath = filePath;
        const dir = path_1.default.dirname(filePath);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
    }
    load() {
        if (this.cache) {
            return this.cache;
        }
        if (!fs_1.default.existsSync(this.filePath)) {
            this.cache = structuredClone(EMPTY_DB);
            this.save();
            return this.cache;
        }
        const parsed = JSON.parse(fs_1.default.readFileSync(this.filePath, 'utf-8'));
        this.cache = {
            ...structuredClone(EMPTY_DB),
            ...parsed,
            lookups: { ...EMPTY_DB.lookups, ...parsed.lookups },
            nextIds: { ...EMPTY_DB.nextIds, ...parsed.nextIds },
            organizations: parsed.organizations ?? [],
            permissions: parsed.permissions ?? [],
            rolePermissions: parsed.rolePermissions ?? [],
            userStudentLinks: parsed.userStudentLinks ?? [],
            parents: parsed.parents ?? [],
            parentStudentMappings: parsed.parentStudentMappings ?? [],
            parentNotificationPreferences: parsed.parentNotificationPreferences ?? [],
            teacherGroupAssignments: parsed.teacherGroupAssignments ?? [],
            groupStudents: parsed.groupStudents ?? [],
            events: parsed.events ?? [],
            eventParticipants: parsed.eventParticipants ?? [],
            attendanceRecords: parsed.attendanceRecords ?? [],
            customFieldDefinitions: parsed.customFieldDefinitions ?? [],
            customFieldValues: parsed.customFieldValues ?? [],
            auditLogs: parsed.auditLogs ?? [],
            certificateTemplates: parsed.certificateTemplates ?? [],
            certificates: parsed.certificates ?? [],
            awards: parsed.awards ?? [],
            voiceEntries: parsed.voiceEntries ?? [],
            voiceEntryEdits: parsed.voiceEntryEdits ?? [],
            users: parsed.users ?? [],
            studentGroups: parsed.studentGroups ?? [],
            students: parsed.students ?? [],
            studentActivities: parsed.studentActivities ?? [],
        };
        if ((0, json_migrations_1.runJsonBackfills)(this.cache)) {
            this.save();
        }
        return this.cache;
    }
    save() {
        if (!this.cache) {
            return;
        }
        fs_1.default.writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2), 'utf-8');
    }
    nextId(table) {
        const db = this.load();
        const id = db.nextIds[table];
        db.nextIds[table] = id + 1;
        this.save();
        return id;
    }
    // Organizations
    getOrganization(id = 1) {
        return this.load().organizations.find((org) => org.id === id);
    }
    insertOrganization(org) {
        this.load().organizations.push(org);
        this.save();
    }
    updateOrganization(org) {
        const db = this.load();
        const index = db.organizations.findIndex((item) => item.id === org.id);
        if (index < 0) {
            return false;
        }
        db.organizations[index] = org;
        this.save();
        return true;
    }
    countOrganizations() {
        return this.load().organizations.length;
    }
    // Users
    findUserByEmail(email) {
        return this.load().users.find((user) => user.email === email);
    }
    findUserById(id) {
        return this.load().users.find((user) => user.id === id);
    }
    listUsers(organizationId) {
        const users = [...this.load().users].sort((a, b) => a.name.localeCompare(b.name));
        if (organizationId === undefined) {
            return users;
        }
        return users.filter((user) => user.organization_id === organizationId);
    }
    insertUser(user) {
        this.load().users.push({
            ...user,
            organization_id: user.organization_id ?? 1,
        });
        this.save();
    }
    updateUser(user) {
        const db = this.load();
        const index = db.users.findIndex((item) => item.id === user.id);
        if (index < 0) {
            return false;
        }
        db.users[index] = user;
        this.save();
        return true;
    }
    deleteUser(id) {
        const db = this.load();
        const index = db.users.findIndex((user) => user.id === id);
        if (index < 0) {
            return false;
        }
        db.users.splice(index, 1);
        db.userStudentLinks = db.userStudentLinks.filter((link) => link.user_id !== id);
        db.teacherGroupAssignments = db.teacherGroupAssignments.filter((assignment) => assignment.user_id !== id);
        this.save();
        return true;
    }
    countUsers() {
        return this.load().users.length;
    }
    // User-student links
    linkParentToStudent(link) {
        const db = this.load();
        const exists = db.userStudentLinks.some((item) => item.user_id === link.user_id && item.student_id === link.student_id);
        if (exists) {
            return;
        }
        db.userStudentLinks.push({
            ...link,
            organization_id: link.organization_id ?? 1,
        });
        this.save();
    }
    unlinkParentFromStudent(userId, studentId) {
        const db = this.load();
        const before = db.userStudentLinks.length;
        db.userStudentLinks = db.userStudentLinks.filter((link) => !(link.user_id === userId && link.student_id === studentId));
        if (db.userStudentLinks.length === before) {
            return false;
        }
        this.save();
        return true;
    }
    getLinkedStudents(userId) {
        return [...this.load().userStudentLinks]
            .filter((link) => link.user_id === userId)
            .sort((a, b) => b.is_primary - a.is_primary || a.id - b.id);
    }
    listUserStudentLinksUpdatedSince(since, organizationId = 1) {
        const sinceIso = since.toISOString();
        return this.load().userStudentLinks.filter((link) => link.organization_id === organizationId && link.created_at >= sinceIso);
    }
    getLinkedStudentIds(userId) {
        const linkIds = this.getLinkedStudents(userId).map((link) => link.student_id);
        const parentIds = this.getStudentIdsForParentUser(userId);
        return [...new Set([...linkIds, ...parentIds])];
    }
    listParents(organizationId = 1) {
        return [...this.load().parents]
            .filter((p) => p.organization_id === organizationId)
            .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
    }
    listParentsUpdatedSince(since, organizationId = 1) {
        const sinceIso = since.toISOString();
        return this.listParents(organizationId).filter((p) => p.updated_at >= sinceIso);
    }
    getParentById(id) {
        return this.load().parents.find((p) => p.id === id);
    }
    getParentByUserId(userId) {
        return this.load().parents.find((p) => p.user_id === userId);
    }
    getParentByClientId(clientId) {
        return this.load().parents.find((p) => p.client_id === clientId);
    }
    insertParent(parent) {
        this.load().parents.push(parent);
        this.save();
    }
    updateParent(parent) {
        const db = this.load();
        const index = db.parents.findIndex((p) => p.id === parent.id);
        if (index < 0) {
            return false;
        }
        db.parents[index] = parent;
        this.save();
        return true;
    }
    countParents() {
        return this.load().parents.length;
    }
    listParentMappings(parentId, studentId) {
        return [...this.load().parentStudentMappings]
            .filter((m) => (parentId == null || m.parent_id === parentId) && (studentId == null || m.student_id === studentId))
            .sort((a, b) => b.is_primary_contact - a.is_primary_contact || a.id - b.id);
    }
    listParentMappingsUpdatedSince(since, organizationId = 1) {
        const sinceIso = since.toISOString();
        return this.load().parentStudentMappings.filter((m) => m.organization_id === organizationId && m.created_at >= sinceIso);
    }
    getParentMapping(parentId, studentId) {
        return this.load().parentStudentMappings.find((m) => m.parent_id === parentId && m.student_id === studentId);
    }
    insertParentMapping(mapping) {
        this.load().parentStudentMappings.push(mapping);
        this.save();
    }
    deleteParentMapping(parentId, studentId) {
        const db = this.load();
        const before = db.parentStudentMappings.length;
        db.parentStudentMappings = db.parentStudentMappings.filter((m) => !(m.parent_id === parentId && m.student_id === studentId));
        if (db.parentStudentMappings.length === before) {
            return false;
        }
        this.save();
        return true;
    }
    getStudentIdsForParentUser(userId) {
        const parent = this.getParentByUserId(userId);
        if (!parent) {
            return [];
        }
        return this.listParentMappings(parent.id).map((m) => m.student_id);
    }
    getParentNotificationPreferences(parentId) {
        return this.load().parentNotificationPreferences.find((p) => p.parent_id === parentId);
    }
    upsertParentNotificationPreferences(prefs) {
        const db = this.load();
        const index = db.parentNotificationPreferences.findIndex((p) => p.parent_id === prefs.parent_id);
        if (index >= 0) {
            db.parentNotificationPreferences[index] = prefs;
        }
        else {
            db.parentNotificationPreferences.push(prefs);
        }
        this.save();
        return prefs;
    }
    listParentNotificationPreferencesUpdatedSince(since, organizationId = 1) {
        const sinceIso = since.toISOString();
        return this.load().parentNotificationPreferences.filter((p) => p.organization_id === organizationId && p.updated_at >= sinceIso);
    }
    // Permissions
    listPermissions() {
        return [...this.load().permissions].sort((a, b) => {
            const moduleCompare = a.module.localeCompare(b.module);
            return moduleCompare !== 0 ? moduleCompare : a.action.localeCompare(b.action);
        });
    }
    insertPermission(permission) {
        this.load().permissions.push(permission);
        this.save();
    }
    countPermissions() {
        return this.load().permissions.length;
    }
    listRolePermissions(role) {
        const items = [...this.load().rolePermissions];
        if (role) {
            return items.filter((item) => item.role === role).sort((a, b) => a.id - b.id);
        }
        return items.sort((a, b) => a.role.localeCompare(b.role) || a.id - b.id);
    }
    insertRolePermission(rp) {
        this.load().rolePermissions.push(rp);
        this.save();
    }
    countRolePermissions() {
        return this.load().rolePermissions.length;
    }
    seedPermissionsAndRoles(permissions, rolePermissions) {
        const db = this.load();
        db.permissions = permissions;
        db.rolePermissions = rolePermissions;
        this.save();
    }
    // Teacher assignments
    assignTeacherToGroup(assignment) {
        const db = this.load();
        const exists = db.teacherGroupAssignments.some((item) => item.user_id === assignment.user_id && item.group_id === assignment.group_id);
        if (exists) {
            return;
        }
        db.teacherGroupAssignments.push({
            ...assignment,
            organization_id: assignment.organization_id ?? 1,
        });
        this.save();
    }
    getTeacherGroupIds(userId) {
        return this.load()
            .teacherGroupAssignments.filter((assignment) => assignment.user_id === userId)
            .map((assignment) => assignment.group_id);
    }
    // Groups
    listGroups() {
        return [...this.load().studentGroups].sort((a, b) => a.name.localeCompare(b.name));
    }
    listGroupsCreatedSince(since) {
        const sinceTime = since.getTime();
        return this.load().studentGroups.filter((group) => new Date(group.created_at).getTime() > sinceTime);
    }
    findGroupByClientId(clientId) {
        return this.load().studentGroups.find((group) => group.client_id === clientId);
    }
    insertGroup(group) {
        this.load().studentGroups.push({
            ...group,
            organization_id: group.organization_id ?? 1,
        });
        this.save();
    }
    updateGroup(group) {
        const db = this.load();
        const index = db.studentGroups.findIndex((item) => item.id === group.id);
        if (index < 0) {
            return false;
        }
        db.studentGroups[index] = group;
        this.save();
        return true;
    }
    deleteGroup(id) {
        const db = this.load();
        const group = db.studentGroups.find((item) => item.id === id);
        if (!group || group.is_default) {
            return false;
        }
        db.studentGroups = db.studentGroups.filter((item) => item.id !== id);
        db.groupStudents = db.groupStudents.filter((item) => item.group_id !== id);
        db.teacherGroupAssignments = db.teacherGroupAssignments.filter((assignment) => assignment.group_id !== id);
        this.save();
        return true;
    }
    findGroupById(id) {
        return this.load().studentGroups.find((group) => group.id === id);
    }
    countGroups() {
        return this.load().studentGroups.length;
    }
    // Group-student assignments
    assignStudentToGroup(record) {
        const db = this.load();
        const exists = db.groupStudents.some((item) => item.group_id === record.group_id && item.student_id === record.student_id);
        if (exists) {
            return;
        }
        db.groupStudents.push({
            ...record,
            organization_id: record.organization_id ?? 1,
        });
        this.save();
    }
    unassignStudentFromGroup(groupId, studentId) {
        const db = this.load();
        const before = db.groupStudents.length;
        db.groupStudents = db.groupStudents.filter((item) => !(item.group_id === groupId && item.student_id === studentId));
        if (db.groupStudents.length === before) {
            return false;
        }
        this.save();
        return true;
    }
    listGroupStudents(groupId) {
        return [...this.load().groupStudents]
            .filter((item) => item.group_id === groupId)
            .sort((a, b) => new Date(a.assigned_at).getTime() - new Date(b.assigned_at).getTime());
    }
    listStudentGroups(studentId) {
        return [...this.load().groupStudents]
            .filter((item) => item.student_id === studentId)
            .sort((a, b) => new Date(a.assigned_at).getTime() - new Date(b.assigned_at).getTime());
    }
    // Students
    listStudents(groupId, organizationId) {
        let students = [...this.load().students].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        if (groupId !== undefined) {
            students = students.filter((student) => student.group_id === groupId);
        }
        if (organizationId !== undefined) {
            students = students.filter((student) => student.organization_id === organizationId);
        }
        return students;
    }
    listStudentsUpdatedSince(since) {
        const sinceTime = since.getTime();
        return this.load().students.filter((student) => new Date(student.updated_at).getTime() > sinceTime);
    }
    listStudentsByIds(ids) {
        if (ids.length === 0) {
            return [];
        }
        const idSet = new Set(ids);
        return this.load().students.filter((student) => idSet.has(student.id));
    }
    getStudentById(id) {
        return this.load().students.find((student) => student.id === id);
    }
    getStudentByClientId(clientId) {
        return this.load().students.find((student) => student.client_id === clientId);
    }
    insertStudent(student) {
        this.load().students.push({
            ...student,
            organization_id: student.organization_id ?? 1,
        });
        this.save();
    }
    updateStudentRecord(student) {
        const db = this.load();
        const index = db.students.findIndex((item) => item.id === student.id);
        if (index < 0) {
            return false;
        }
        db.students[index] = student;
        this.save();
        return true;
    }
    deleteStudent(id) {
        const db = this.load();
        const index = db.students.findIndex((student) => student.id === id);
        if (index < 0) {
            return false;
        }
        db.students.splice(index, 1);
        db.studentActivities = db.studentActivities.filter((activity) => activity.student_id !== id);
        db.userStudentLinks = db.userStudentLinks.filter((link) => link.student_id !== id);
        db.groupStudents = db.groupStudents.filter((item) => item.student_id !== id);
        db.eventParticipants = db.eventParticipants.filter((participant) => participant.student_id !== id);
        db.attendanceRecords = db.attendanceRecords.filter((record) => record.student_id !== id);
        this.save();
        return true;
    }
    // Activities
    insertActivity(activity) {
        this.load().studentActivities.push(activity);
        this.save();
    }
    listActivities(studentId, limit = 20) {
        let items = [...this.load().studentActivities].sort((a, b) => b.id - a.id);
        if (studentId) {
            items = items.filter((activity) => activity.student_id === studentId);
        }
        return items.slice(0, limit);
    }
    deleteActivitiesByStudentId(studentId) {
        const db = this.load();
        db.studentActivities = db.studentActivities.filter((activity) => activity.student_id !== studentId);
        this.save();
    }
    // Events
    listEvents(filters = {}) {
        let events = [...this.load().events];
        if (filters.organizationId !== undefined) {
            events = events.filter((event) => event.organization_id === filters.organizationId);
        }
        if (filters.groupId !== undefined) {
            events = events.filter((event) => event.group_id === filters.groupId);
        }
        if (filters.status !== undefined) {
            events = events.filter((event) => event.status === filters.status);
        }
        if (filters.fromDate !== undefined) {
            events = events.filter((event) => event.start_date >= filters.fromDate);
        }
        if (filters.toDate !== undefined) {
            events = events.filter((event) => event.start_date <= filters.toDate);
        }
        if (filters.studentId !== undefined) {
            const participantEventIds = new Set(this.load()
                .eventParticipants.filter((participant) => participant.student_id === filters.studentId)
                .map((participant) => participant.event_id));
            events = events.filter((event) => participantEventIds.has(event.id));
        }
        return events.sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id - b.id);
    }
    getEventById(id) {
        return this.load().events.find((event) => event.id === id);
    }
    getEventByClientId(clientId) {
        return this.load().events.find((event) => event.client_id === clientId);
    }
    listEventsUpdatedSince(since, organizationId = 1) {
        const sinceIso = since.toISOString();
        return this.load().events.filter((event) => event.organization_id === organizationId && event.updated_at >= sinceIso);
    }
    insertEvent(event) {
        this.load().events.push({
            ...event,
            organization_id: event.organization_id ?? 1,
        });
        this.save();
    }
    updateEvent(event) {
        const db = this.load();
        const index = db.events.findIndex((item) => item.id === event.id);
        if (index < 0) {
            return false;
        }
        db.events[index] = event;
        this.save();
        return true;
    }
    deleteEvent(id) {
        const db = this.load();
        const index = db.events.findIndex((event) => event.id === id);
        if (index < 0) {
            return false;
        }
        db.events.splice(index, 1);
        db.eventParticipants = db.eventParticipants.filter((participant) => participant.event_id !== id);
        db.attendanceRecords = db.attendanceRecords.filter((record) => record.event_id !== id);
        this.save();
        return true;
    }
    // Event participants
    addEventParticipant(participant) {
        const db = this.load();
        const exists = db.eventParticipants.some((item) => item.event_id === participant.event_id && item.student_id === participant.student_id);
        if (exists) {
            return;
        }
        db.eventParticipants.push(participant);
        this.save();
    }
    removeEventParticipant(eventId, studentId) {
        const db = this.load();
        const before = db.eventParticipants.length;
        db.eventParticipants = db.eventParticipants.filter((participant) => !(participant.event_id === eventId && participant.student_id === studentId));
        if (db.eventParticipants.length === before) {
            return false;
        }
        this.save();
        return true;
    }
    listEventParticipants(eventId) {
        return [...this.load().eventParticipants]
            .filter((participant) => participant.event_id === eventId)
            .sort((a, b) => a.id - b.id);
    }
    // Attendance
    listAttendance(filters = {}) {
        let records = [...this.load().attendanceRecords];
        if (filters.organizationId !== undefined) {
            records = records.filter((record) => record.organization_id === filters.organizationId);
        }
        if (filters.date !== undefined) {
            records = records.filter((record) => record.attendance_date === filters.date);
        }
        if (filters.groupId !== undefined) {
            records = records.filter((record) => record.group_id === filters.groupId);
        }
        if (filters.studentId !== undefined) {
            records = records.filter((record) => record.student_id === filters.studentId);
        }
        if (filters.eventId !== undefined) {
            records = records.filter((record) => record.event_id === filters.eventId);
        }
        if (filters.contextType !== undefined) {
            records = records.filter((record) => record.context_type === filters.contextType);
        }
        if (filters.periodNumber !== undefined) {
            records = records.filter((record) => record.period_number === filters.periodNumber);
        }
        if (filters.fromDate !== undefined) {
            records = records.filter((record) => record.attendance_date >= filters.fromDate);
        }
        if (filters.toDate !== undefined) {
            records = records.filter((record) => record.attendance_date <= filters.toDate);
        }
        return records.sort((a, b) => {
            const dateCompare = b.attendance_date.localeCompare(a.attendance_date);
            if (dateCompare !== 0) {
                return dateCompare;
            }
            return a.student_id - b.student_id || a.id - b.id;
        });
    }
    getAttendanceById(id) {
        return this.load().attendanceRecords.find((record) => record.id === id);
    }
    getAttendanceByClientId(clientId) {
        return this.load().attendanceRecords.find((record) => record.client_id === clientId);
    }
    listAttendanceUpdatedSince(since, organizationId = 1) {
        const sinceIso = since.toISOString();
        return this.load().attendanceRecords.filter((record) => record.organization_id === organizationId && record.updated_at >= sinceIso);
    }
    insertAttendance(record) {
        this.load().attendanceRecords.push({
            ...record,
            organization_id: record.organization_id ?? 1,
        });
        this.save();
    }
    updateAttendance(record) {
        const db = this.load();
        const index = db.attendanceRecords.findIndex((item) => item.id === record.id);
        if (index < 0) {
            return false;
        }
        db.attendanceRecords[index] = record;
        this.save();
        return true;
    }
    upsertAttendance(record) {
        const existing = this.findAttendanceByUniqueKey(record);
        if (existing) {
            const updated = {
                ...record,
                id: existing.id,
                created_at: existing.created_at,
            };
            this.updateAttendance(updated);
            return updated;
        }
        this.insertAttendance(record);
        return record;
    }
    deleteAttendance(id) {
        const db = this.load();
        const index = db.attendanceRecords.findIndex((record) => record.id === id);
        if (index < 0) {
            return false;
        }
        db.attendanceRecords.splice(index, 1);
        this.save();
        return true;
    }
    // Custom field definitions
    listCustomFieldDefinitions(filters = {}) {
        const orgId = filters.organizationId ?? 1;
        let items = this.load().customFieldDefinitions.filter((d) => d.organization_id === orgId);
        if (filters.entityType) {
            items = items.filter((d) => d.entity_type === filters.entityType);
        }
        if (!filters.includeInactive) {
            items = items.filter((d) => d.is_active);
        }
        return items.sort((a, b) => a.display_order - b.display_order || a.id - b.id);
    }
    listCustomFieldDefinitionsUpdatedSince(since, organizationId = 1) {
        const sinceTime = since.getTime();
        return this.load().customFieldDefinitions.filter((d) => d.organization_id === organizationId &&
            new Date(d.updated_at).getTime() > sinceTime);
    }
    getCustomFieldDefinitionById(id) {
        return this.load().customFieldDefinitions.find((d) => d.id === id);
    }
    getCustomFieldDefinitionByName(organizationId, entityType, fieldName) {
        return this.load().customFieldDefinitions.find((d) => d.organization_id === organizationId &&
            d.entity_type === entityType &&
            d.field_name === fieldName);
    }
    insertCustomFieldDefinition(definition) {
        this.load().customFieldDefinitions.push(definition);
        this.save();
    }
    updateCustomFieldDefinition(definition) {
        const db = this.load();
        const index = db.customFieldDefinitions.findIndex((d) => d.id === definition.id);
        if (index < 0) {
            return false;
        }
        db.customFieldDefinitions[index] = definition;
        this.save();
        return true;
    }
    deleteCustomFieldDefinition(id) {
        const db = this.load();
        const index = db.customFieldDefinitions.findIndex((d) => d.id === id);
        if (index < 0) {
            return false;
        }
        db.customFieldDefinitions.splice(index, 1);
        db.customFieldValues = db.customFieldValues.filter((v) => v.field_definition_id !== id);
        this.save();
        return true;
    }
    // Custom field values
    listCustomFieldValues(entityType, entityId) {
        return this.load().customFieldValues.filter((v) => v.entity_type === entityType && v.entity_id === entityId);
    }
    listCustomFieldValuesUpdatedSince(since, organizationId = 1) {
        const sinceTime = since.getTime();
        return this.load().customFieldValues.filter((v) => v.organization_id === organizationId &&
            new Date(v.updated_at).getTime() > sinceTime);
    }
    upsertCustomFieldValue(value) {
        const db = this.load();
        const index = db.customFieldValues.findIndex((v) => v.field_definition_id === value.field_definition_id &&
            v.entity_type === value.entity_type &&
            v.entity_id === value.entity_id);
        if (index >= 0) {
            const updated = { ...value, id: db.customFieldValues[index].id };
            db.customFieldValues[index] = updated;
            this.save();
            return updated;
        }
        db.customFieldValues.push(value);
        this.save();
        return value;
    }
    deleteCustomFieldValuesForEntity(entityType, entityId) {
        const db = this.load();
        db.customFieldValues = db.customFieldValues.filter((v) => !(v.entity_type === entityType && v.entity_id === entityId));
        this.save();
    }
    // Audit logs
    insertAuditLog(log) {
        this.load().auditLogs.push(log);
        this.save();
    }
    listAuditLogs(entityType, entityId, limit = 50) {
        let items = [...this.load().auditLogs].sort((a, b) => b.id - a.id);
        if (entityType && entityId !== undefined) {
            items = items.filter((l) => l.entity_type === entityType && l.entity_id === entityId);
        }
        return items.slice(0, limit);
    }
    // Voice entries
    listVoiceEntries(filters = {}) {
        let items = this.filterVoiceEntries(filters);
        items.sort((a, b) => b.created_at.localeCompare(a.created_at));
        const offset = filters.offset ?? 0;
        const limit = filters.limit ?? 100;
        return items.slice(offset, offset + limit);
    }
    countVoiceEntries(filters = {}) {
        return this.filterVoiceEntries(filters).length;
    }
    listVoiceEntriesUpdatedSince(since, organizationId = 1) {
        const sinceTime = since.getTime();
        return this.load().voiceEntries.filter((e) => e.organization_id === organizationId &&
            new Date(e.modified_at).getTime() > sinceTime);
    }
    getVoiceEntryById(id) {
        return this.load().voiceEntries.find((e) => e.id === id);
    }
    getVoiceEntryByClientId(clientId) {
        return this.load().voiceEntries.find((e) => e.client_id === clientId);
    }
    insertVoiceEntry(entry) {
        this.load().voiceEntries.push(entry);
        this.save();
    }
    updateVoiceEntry(entry) {
        const db = this.load();
        const index = db.voiceEntries.findIndex((e) => e.id === entry.id);
        if (index < 0) {
            return false;
        }
        db.voiceEntries[index] = entry;
        this.save();
        return true;
    }
    deleteVoiceEntry(id) {
        const db = this.load();
        const index = db.voiceEntries.findIndex((e) => e.id === id);
        if (index < 0) {
            return false;
        }
        db.voiceEntries.splice(index, 1);
        db.voiceEntryEdits = db.voiceEntryEdits.filter((e) => e.voice_entry_id !== id);
        this.save();
        return true;
    }
    listVoiceEntryEdits(voiceEntryId) {
        return this.load()
            .voiceEntryEdits.filter((e) => e.voice_entry_id === voiceEntryId)
            .sort((a, b) => a.id - b.id);
    }
    insertVoiceEntryEdit(edit) {
        this.load().voiceEntryEdits.push(edit);
        this.save();
    }
    filterVoiceEntries(filters) {
        const orgId = filters.organizationId ?? 1;
        let items = this.load().voiceEntries.filter((e) => e.organization_id === orgId);
        if (filters.studentId !== undefined) {
            items = items.filter((e) => e.student_id === filters.studentId);
        }
        if (filters.moduleCode) {
            items = items.filter((e) => e.module_code === filters.moduleCode);
        }
        if (filters.status) {
            items = items.filter((e) => e.status === filters.status);
        }
        if (filters.speechEngine) {
            items = items.filter((e) => e.speech_engine === filters.speechEngine);
        }
        if (filters.createdBy !== undefined) {
            items = items.filter((e) => e.created_by === filters.createdBy);
        }
        if (filters.fromDate) {
            items = items.filter((e) => e.created_at >= filters.fromDate);
        }
        if (filters.toDate) {
            items = items.filter((e) => e.created_at <= filters.toDate);
        }
        if (filters.search?.trim()) {
            const term = filters.search.trim().toLowerCase();
            items = items.filter((e) => e.transcript.toLowerCase().includes(term) ||
                (e.processed_json ?? '').toLowerCase().includes(term));
        }
        return items;
    }
    // Certificate templates
    listCertificateTemplates(organizationId = 1, includeInactive = false) {
        let items = this.load().certificateTemplates.filter((t) => t.organization_id === organizationId);
        if (!includeInactive) {
            items = items.filter((t) => t.is_active === 1);
        }
        return items.sort((a, b) => a.name.localeCompare(b.name));
    }
    listCertificateTemplatesUpdatedSince(since, organizationId = 1) {
        const sinceTime = since.getTime();
        return this.load().certificateTemplates.filter((t) => t.organization_id === organizationId && new Date(t.updated_at).getTime() > sinceTime);
    }
    getCertificateTemplateById(id) {
        return this.load().certificateTemplates.find((t) => t.id === id);
    }
    getCertificateTemplateByClientId(clientId) {
        return this.load().certificateTemplates.find((t) => t.client_id === clientId);
    }
    insertCertificateTemplate(template) {
        this.load().certificateTemplates.push(template);
        this.save();
    }
    updateCertificateTemplate(template) {
        const db = this.load();
        const index = db.certificateTemplates.findIndex((t) => t.id === template.id);
        if (index < 0) {
            return false;
        }
        db.certificateTemplates[index] = template;
        this.save();
        return true;
    }
    // Certificates
    listCertificates(filters = {}) {
        let items = this.filterCertificates(filters);
        items.sort((a, b) => b.issue_date.localeCompare(a.issue_date));
        const offset = filters.offset ?? 0;
        const limit = filters.limit ?? 100;
        return items.slice(offset, offset + limit);
    }
    countCertificates(filters = {}) {
        return this.filterCertificates(filters).length;
    }
    listCertificatesUpdatedSince(since, organizationId = 1) {
        const sinceTime = since.getTime();
        return this.load().certificates.filter((c) => c.organization_id === organizationId && new Date(c.updated_at).getTime() > sinceTime);
    }
    getCertificateById(id) {
        return this.load().certificates.find((c) => c.id === id);
    }
    getCertificateByClientId(clientId) {
        return this.load().certificates.find((c) => c.client_id === clientId);
    }
    getCertificateByVerificationCode(code) {
        return this.load().certificates.find((c) => c.verification_code === code);
    }
    getCertificateByNumber(organizationId, certificateNumber) {
        return this.load().certificates.find((c) => c.organization_id === organizationId && c.certificate_number === certificateNumber);
    }
    insertCertificate(certificate) {
        this.load().certificates.push(certificate);
        this.save();
    }
    updateCertificate(certificate) {
        const db = this.load();
        const index = db.certificates.findIndex((c) => c.id === certificate.id);
        if (index < 0) {
            return false;
        }
        db.certificates[index] = certificate;
        this.save();
        return true;
    }
    // Awards
    listAwards(filters = {}) {
        let items = this.filterAwards(filters);
        items.sort((a, b) => b.award_date.localeCompare(a.award_date));
        const offset = filters.offset ?? 0;
        const limit = filters.limit ?? 100;
        return items.slice(offset, offset + limit);
    }
    countAwards(filters = {}) {
        return this.filterAwards(filters).length;
    }
    listAwardsUpdatedSince(since, organizationId = 1) {
        const sinceTime = since.getTime();
        return this.load().awards.filter((a) => a.organization_id === organizationId && new Date(a.updated_at).getTime() > sinceTime);
    }
    getAwardById(id) {
        return this.load().awards.find((a) => a.id === id);
    }
    getAwardByClientId(clientId) {
        return this.load().awards.find((a) => a.client_id === clientId);
    }
    getAwardByVerificationCode(code) {
        return this.load().awards.find((a) => a.verification_code === code);
    }
    insertAward(award) {
        this.load().awards.push(award);
        this.save();
    }
    updateAward(award) {
        const db = this.load();
        const index = db.awards.findIndex((a) => a.id === award.id);
        if (index < 0) {
            return false;
        }
        db.awards[index] = award;
        this.save();
        return true;
    }
    filterCertificates(filters) {
        const orgId = filters.organizationId ?? 1;
        let items = this.load().certificates.filter((c) => c.organization_id === orgId);
        if (filters.studentId !== undefined) {
            items = items.filter((c) => c.student_id === filters.studentId);
        }
        if (filters.certificateType) {
            items = items.filter((c) => c.certificate_type === filters.certificateType);
        }
        if (filters.status) {
            items = items.filter((c) => c.status === filters.status);
        }
        if (filters.templateId !== undefined) {
            items = items.filter((c) => c.template_id === filters.templateId);
        }
        if (filters.fromDate) {
            items = items.filter((c) => c.issue_date >= filters.fromDate);
        }
        if (filters.toDate) {
            items = items.filter((c) => c.issue_date <= filters.toDate);
        }
        if (filters.search?.trim()) {
            const term = filters.search.trim().toLowerCase();
            items = items.filter((c) => c.title.toLowerCase().includes(term) ||
                c.certificate_number.toLowerCase().includes(term) ||
                (c.description ?? '').toLowerCase().includes(term));
        }
        return items;
    }
    filterAwards(filters) {
        const orgId = filters.organizationId ?? 1;
        let items = this.load().awards.filter((a) => a.organization_id === orgId);
        if (filters.studentId !== undefined) {
            items = items.filter((a) => a.student_id === filters.studentId);
        }
        if (filters.category) {
            items = items.filter((a) => a.category === filters.category);
        }
        if (filters.status) {
            items = items.filter((a) => a.status === filters.status);
        }
        if (filters.fromDate) {
            items = items.filter((a) => a.award_date >= filters.fromDate);
        }
        if (filters.toDate) {
            items = items.filter((a) => a.award_date <= filters.toDate);
        }
        if (filters.search?.trim()) {
            const term = filters.search.trim().toLowerCase();
            items = items.filter((a) => a.title.toLowerCase().includes(term) ||
                (a.description ?? '').toLowerCase().includes(term));
        }
        return items;
    }
    // Lookups
    getAllLookups() {
        return this.load().lookups ?? structuredClone(EMPTY_DB.lookups);
    }
    getLookupCategory(category) {
        const lookups = this.getAllLookups();
        if (!(category in lookups)) {
            return null;
        }
        return lookups[category] ?? [];
    }
    seedLookups(defaults) {
        const db = this.load();
        if (!db.lookups) {
            db.lookups = structuredClone(defaults);
            this.save();
            return;
        }
        let changed = false;
        for (const [key, options] of Object.entries(defaults)) {
            const category = key;
            if (!db.lookups[category]?.length) {
                db.lookups[category] = structuredClone(options);
                changed = true;
            }
        }
        if (changed) {
            this.save();
        }
    }
    countLookups() {
        const lookups = this.getAllLookups();
        return Object.values(lookups).reduce((total, options) => total + options.length, 0);
    }
    findAttendanceByUniqueKey(record) {
        return this.load().attendanceRecords.find((item) => item.student_id === record.student_id &&
            item.attendance_date === record.attendance_date &&
            item.context_type === record.context_type &&
            item.period_number === record.period_number &&
            item.event_id === record.event_id);
    }
}
exports.JsonRepository = JsonRepository;
function createJsonRepository() {
    return new JsonRepository(config_1.config.dbPath);
}
