"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listStudents = listStudents;
exports.getStudentById = getStudentById;
exports.getStudentByClientId = getStudentByClientId;
exports.createStudent = createStudent;
exports.updateStudent = updateStudent;
exports.deleteStudent = deleteStudent;
exports.approveAdmission = approveAdmission;
exports.logActivity = logActivity;
exports.listActivities = listActivities;
exports.listGroups = listGroups;
exports.createGroup = createGroup;
exports.deleteGroup = deleteGroup;
exports.updateGroup = updateGroup;
exports.assignStudentsToGroup = assignStudentsToGroup;
exports.getDashboardStats = getDashboardStats;
exports.formatCode = formatCode;
exports.studentToApi = studentToApi;
exports.apiToStudentInput = apiToStudentInput;
const database_1 = require("../db/database");
const custom_field_service_1 = require("./custom-field.service");
function listStudents(groupId) {
    return (0, database_1.getRepository)().listStudents(groupId);
}
function getStudentById(id) {
    return (0, database_1.getRepository)().getStudentById(id);
}
function getStudentByClientId(clientId) {
    return (0, database_1.getRepository)().getStudentByClientId(clientId);
}
function createStudent(input, userId) {
    const repo = (0, database_1.getRepository)();
    const now = new Date().toISOString();
    const id = repo.nextId('students');
    const student = {
        id,
        organization_id: 1,
        name: input.name,
        class: input.class ?? '',
        roll_no: input.rollNo ?? '',
        mobile: input.mobile ?? '',
        address: input.address ?? '',
        admission_no: input.admissionNo ?? null,
        parent_name: input.parentName ?? null,
        parent_mobile: input.parentMobile ?? null,
        academic_year: input.academicYear ?? null,
        section: input.section ?? null,
        status: input.status ?? 'new_admission',
        fee_status: input.feeStatus ?? 'not_applicable',
        group_id: input.groupId ?? null,
        custom_data: input.customData ?? null,
        client_id: input.clientId ?? null,
        created_at: now,
        updated_at: now,
    };
    repo.insertStudent(student);
    logActivity(id, 'create', `Student (${formatCode(id)}) created`, userId);
    if (input.customFields?.length) {
        (0, custom_field_service_1.saveEntityValues)('student', id, input.customFields, userId);
    }
    else if (input.customData) {
        (0, custom_field_service_1.migrateStudentCustomDataToEav)(id, input.customData);
    }
    return student;
}
function updateStudent(id, input, userId) {
    const repo = (0, database_1.getRepository)();
    const existing = repo.getStudentById(id);
    if (!existing) {
        return undefined;
    }
    const now = new Date().toISOString();
    const updated = {
        ...existing,
        name: input.name ?? existing.name,
        class: input.class ?? existing.class,
        roll_no: input.rollNo ?? existing.roll_no,
        mobile: input.mobile ?? existing.mobile,
        address: input.address ?? existing.address,
        admission_no: input.admissionNo ?? existing.admission_no,
        parent_name: input.parentName ?? existing.parent_name,
        parent_mobile: input.parentMobile ?? existing.parent_mobile,
        academic_year: input.academicYear ?? existing.academic_year,
        section: input.section ?? existing.section,
        status: input.status ?? existing.status,
        fee_status: input.feeStatus ?? existing.fee_status,
        group_id: input.groupId ?? existing.group_id,
        custom_data: input.customData ?? existing.custom_data,
        updated_at: now,
    };
    repo.updateStudentRecord(updated);
    logActivity(id, 'update', `Student (${formatCode(id)}) updated`, userId);
    if (input.customFields?.length) {
        (0, custom_field_service_1.saveEntityValues)('student', id, input.customFields, userId);
    }
    else if (input.customData) {
        (0, custom_field_service_1.migrateStudentCustomDataToEav)(id, input.customData);
    }
    return updated;
}
function deleteStudent(id, userId) {
    const repo = (0, database_1.getRepository)();
    const existing = repo.getStudentById(id);
    if (!existing) {
        return false;
    }
    logActivity(id, 'delete', `Student (${formatCode(id)}) deleted`, userId);
    return repo.deleteStudent(id);
}
function approveAdmission(id, userId) {
    const student = updateStudent(id, { status: 'active' }, userId);
    if (student) {
        logActivity(id, 'admission_approved', `Admission approved for ${student.name}`, userId);
    }
    return student;
}
function logActivity(studentId, action, message, userId) {
    const repo = (0, database_1.getRepository)();
    const dateLabel = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
    const id = repo.nextId('studentActivities');
    const activity = {
        id,
        student_id: studentId,
        action,
        message,
        action_date: dateLabel,
        logged_date: dateLabel,
        user_id: userId ?? null,
    };
    repo.insertActivity(activity);
}
function listActivities(studentId, limit = 20) {
    return (0, database_1.getRepository)().listActivities(studentId, limit);
}
function listGroups() {
    return (0, database_1.getRepository)().listGroups();
}
function createGroup(name, description, clientId) {
    const repo = (0, database_1.getRepository)();
    const id = repo.nextId('studentGroups');
    const group = {
        id,
        organization_id: 1,
        name,
        description: description ?? null,
        is_default: 0,
        client_id: clientId ?? null,
        created_at: new Date().toISOString(),
    };
    repo.insertGroup(group);
    return group;
}
function deleteGroup(id) {
    return (0, database_1.getRepository)().deleteGroup(id);
}
function updateGroup(id, name, description) {
    const repo = (0, database_1.getRepository)();
    const existing = repo.findGroupById(id);
    if (!existing) {
        return undefined;
    }
    const updated = {
        ...existing,
        name: name.trim(),
        description: description?.trim() ?? existing.description,
    };
    repo.updateGroup(updated);
    return updated;
}
function assignStudentsToGroup(groupId, studentIds, assignedBy) {
    const repo = (0, database_1.getRepository)();
    let count = 0;
    const now = new Date().toISOString();
    for (const studentId of studentIds) {
        const existing = repo.listGroupStudents(groupId);
        if (existing.some((g) => g.student_id === studentId)) {
            continue;
        }
        repo.assignStudentToGroup({
            id: repo.nextId('groupStudents'),
            organization_id: 1,
            group_id: groupId,
            student_id: studentId,
            assigned_at: now,
            assigned_by: assignedBy ?? null,
        });
        const student = repo.getStudentById(studentId);
        if (student && student.group_id !== groupId) {
            repo.updateStudentRecord({ ...student, group_id: groupId, updated_at: now });
        }
        count++;
    }
    return count;
}
function getDashboardStats(groupId) {
    const students = listStudents(groupId);
    const statusCounts = {};
    const classCounts = {};
    for (const s of students) {
        statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1;
        const cls = s.class?.trim() || 'Unassigned';
        classCounts[cls] = (classCounts[cls] ?? 0) + 1;
    }
    const worklist = [
        {
            id: 'pending_approval',
            label: 'Pending Admission Approval',
            count: students.filter((s) => s.status === 'pending_approval').length,
        },
        {
            id: 'pending_docs',
            label: 'Pending Documents',
            count: students.filter((s) => s.status === 'pending_docs').length,
        },
        {
            id: 'new_admission',
            label: 'New Admissions',
            count: students.filter((s) => s.status === 'new_admission').length,
        },
    ];
    const alerts = [
        {
            id: 'fee_overdue',
            label: 'Fee Payment Overdue',
            count: students.filter((s) => s.fee_status === 'overdue').length,
        },
        {
            id: 'inactive',
            label: 'Inactive Students',
            count: students.filter((s) => s.status === 'inactive').length,
        },
    ];
    const activities = listActivities(undefined, 10).map((a) => {
        const student = getStudentById(a.student_id);
        return {
            id: String(a.id),
            studentId: a.student_id,
            studentCode: formatCode(a.student_id),
            studentName: student?.name ?? 'Unknown',
            message: a.message,
            actionDate: a.action_date,
            loggedDate: a.logged_date,
        };
    });
    const favorites = students.slice(0, 5).map((s) => ({
        id: String(s.id),
        studentId: s.id,
        title: `${s.name} — ${s.class || 'N/A'}`,
        date: new Date(s.created_at).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        }),
    }));
    return { total: students.length, statusCounts, classCounts, worklist, alerts, activities, favorites };
}
function formatCode(id) {
    return `STU${String(id).padStart(7, '0')}`;
}
function studentToApi(student, includeCustomFields = false) {
    const base = {
        id: student.id,
        name: student.name,
        class: student.class,
        rollNo: student.roll_no,
        mobile: student.mobile,
        address: student.address,
        admissionNo: student.admission_no,
        parentName: student.parent_name,
        parentMobile: student.parent_mobile,
        academicYear: student.academic_year,
        section: student.section,
        status: student.status,
        feeStatus: student.fee_status,
        groupId: student.group_id,
        customData: student.custom_data,
        clientId: student.client_id,
        createdDate: student.created_at,
        updatedDate: student.updated_at,
    };
    if (includeCustomFields) {
        return {
            ...base,
            customFields: (0, custom_field_service_1.getEntityValues)('student', student.id),
        };
    }
    return base;
}
function apiToStudentInput(body) {
    return {
        name: String(body['name'] ?? ''),
        class: body['class'] != null ? String(body['class']) : undefined,
        rollNo: body['rollNo'] != null ? String(body['rollNo']) : undefined,
        mobile: body['mobile'] != null ? String(body['mobile']) : undefined,
        address: body['address'] != null ? String(body['address']) : undefined,
        admissionNo: body['admissionNo'] != null ? String(body['admissionNo']) : undefined,
        parentName: body['parentName'] != null ? String(body['parentName']) : undefined,
        parentMobile: body['parentMobile'] != null ? String(body['parentMobile']) : undefined,
        academicYear: body['academicYear'] != null ? String(body['academicYear']) : undefined,
        section: body['section'] != null ? String(body['section']) : undefined,
        status: body['status'],
        feeStatus: body['feeStatus'],
        groupId: body['groupId'] != null ? Number(body['groupId']) : undefined,
        customData: body['customData'] != null ? String(body['customData']) : undefined,
        clientId: body['clientId'] != null ? Number(body['clientId']) : undefined,
        customFields: body['customFields'],
    };
}
