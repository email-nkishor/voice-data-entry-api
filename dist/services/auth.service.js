"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findUserByEmail = findUserByEmail;
exports.findUserById = findUserById;
exports.createUser = createUser;
exports.verifyPassword = verifyPassword;
exports.signToken = signToken;
exports.toAuthUser = toAuthUser;
exports.seedDefaultUsers = seedDefaultUsers;
exports.ensureDefaultUsers = ensureDefaultUsers;
exports.seedDefaultGroups = seedDefaultGroups;
exports.seedDemoStudentAndLinks = seedDemoStudentAndLinks;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../db/database");
const config_1 = require("../config");
const permission_service_1 = require("./permission.service");
const organization_service_1 = require("./organization.service");
const permission_service_2 = require("./permission.service");
const user_service_1 = require("./user.service");
const parent_entity_service_1 = require("./parent-entity.service");
function findUserByEmail(email) {
    return (0, database_1.getRepository)().findUserByEmail(email);
}
function findUserById(id) {
    return (0, database_1.getRepository)().findUserById(id);
}
function createUser(email, password, name, role, linkedStudentId) {
    const repo = (0, database_1.getRepository)();
    const hash = bcryptjs_1.default.hashSync(password, 10);
    const id = repo.nextId('users');
    const user = {
        id,
        organization_id: 1,
        email,
        password_hash: hash,
        name,
        role,
        status: 'active',
        linked_student_id: linkedStudentId ?? null,
        created_at: new Date().toISOString(),
    };
    repo.insertUser(user);
    return id;
}
function verifyPassword(user, password) {
    return bcryptjs_1.default.compareSync(password, user.password_hash);
}
function signToken(user) {
    return jsonwebtoken_1.default.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        organizationId: user.organizationId,
        permissions: user.permissions,
        linkedStudentIds: user.linkedStudentIds,
    }, config_1.config.jwtSecret, { expiresIn: '7d' });
}
function toAuthUser(user) {
    return (0, permission_service_1.buildAuthUser)(user);
}
function seedDefaultUsers() {
    (0, organization_service_1.seedDefaultOrganization)();
    (0, permission_service_2.seedPermissions)();
    const repo = (0, database_1.getRepository)();
    if (repo.countUsers() === 0) {
        const users = [
            ['admin@institute.local', 'admin123', 'Institute Admin', 'admin'],
            ['clerk@institute.local', 'clerk123', 'Admission Clerk', 'clerk'],
            ['teacher@institute.local', 'teacher123', 'Class Teacher', 'teacher'],
            ['parent@institute.local', 'parent123', 'Parent User', 'parent'],
            ['student@institute.local', 'student123', 'Student User', 'student'],
        ];
        for (const [email, password, name, role] of users) {
            createUser(email, password, name, role);
        }
    }
    else {
        ensureDefaultUsers();
    }
    // Assign teacher to first non-default group
    const groups = repo.listGroups();
    const teacher = repo.findUserByEmail('teacher@institute.local');
    const teachGroup = groups.find((g) => !g.is_default) ?? groups[0];
    if (teacher && teachGroup) {
        const existing = repo.getTeacherGroupIds(teacher.id);
        if (!existing.includes(teachGroup.id)) {
            repo.assignTeacherToGroup({
                id: repo.nextId('teacherGroupAssignments'),
                organization_id: 1,
                user_id: teacher.id,
                group_id: teachGroup.id,
            });
        }
    }
}
const DEFAULT_USER_SEEDS = [
    ['admin@institute.local', 'admin123', 'Institute Admin', 'admin'],
    ['clerk@institute.local', 'clerk123', 'Admission Clerk', 'clerk'],
    ['teacher@institute.local', 'teacher123', 'Class Teacher', 'teacher'],
    ['parent@institute.local', 'parent123', 'Parent User', 'parent'],
    ['student@institute.local', 'student123', 'Student User', 'student'],
];
/** Add any missing demo accounts and backfill legacy user fields. */
function ensureDefaultUsers() {
    const repo = (0, database_1.getRepository)();
    for (const [email, password, name, role] of DEFAULT_USER_SEEDS) {
        const existing = repo.findUserByEmail(email);
        if (!existing) {
            createUser(email, password, name, role);
            continue;
        }
        const patched = {
            ...existing,
            status: existing.status || 'active',
            organization_id: existing.organization_id ?? 1,
            linked_student_id: existing.linked_student_id ?? null,
        };
        if (patched.status !== existing.status ||
            patched.organization_id !== existing.organization_id ||
            patched.linked_student_id !== existing.linked_student_id) {
            repo.updateUser(patched);
        }
    }
}
function seedDefaultGroups() {
    const repo = (0, database_1.getRepository)();
    if (repo.countGroups() > 0) {
        return;
    }
    const groups = [
        ['General Admission', 'Default student group', 1],
        ['MCA Batch 2026', 'Master of Computer Applications', 0],
        ['BCA Batch 2026', 'Bachelor of Computer Applications', 0],
    ];
    for (const [name, desc, isDefault] of groups) {
        const id = repo.nextId('studentGroups');
        repo.insertGroup({
            id,
            organization_id: 1,
            name,
            description: desc,
            is_default: isDefault,
            client_id: null,
            created_at: new Date().toISOString(),
        });
    }
}
function seedDemoStudentAndLinks() {
    const repo = (0, database_1.getRepository)();
    const existingStudent = repo.listStudents()[0];
    if (existingStudent) {
        linkDemoAccounts(existingStudent.id);
        (0, parent_entity_service_1.syncParentEntitiesFromUserLinks)();
        return;
    }
    const now = new Date().toISOString();
    const group = repo.listGroups().find((g) => g.is_default) ?? repo.listGroups()[0];
    const studentId = repo.nextId('students');
    repo.insertStudent({
        id: studentId,
        organization_id: 1,
        name: 'Demo Student',
        class: '10',
        roll_no: '001',
        mobile: '9876543210',
        address: 'Demo Address',
        admission_no: 'ADM001',
        parent_name: 'Parent User',
        parent_mobile: '9876543211',
        academic_year: '2025-26',
        section: 'A',
        status: 'active',
        fee_status: 'paid',
        group_id: group?.id ?? null,
        custom_data: null,
        client_id: null,
        created_at: now,
        updated_at: now,
    });
    linkDemoAccounts(studentId);
    (0, parent_entity_service_1.syncParentEntitiesFromUserLinks)();
}
function linkDemoAccounts(studentId) {
    const repo = (0, database_1.getRepository)();
    const parent = repo.findUserByEmail('parent@institute.local');
    const studentUser = repo.findUserByEmail('student@institute.local');
    if (parent) {
        (0, user_service_1.linkParentToStudent)(parent.id, studentId, 'guardian');
        const updatedParent = repo.findUserById(parent.id);
        if (updatedParent) {
            repo.updateUser({ ...updatedParent, linked_student_id: studentId });
        }
    }
    if (studentUser) {
        repo.updateUser({
            ...studentUser,
            linked_student_id: studentId,
        });
    }
}
