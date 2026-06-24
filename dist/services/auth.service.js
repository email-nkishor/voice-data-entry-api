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
exports.seedDefaultGroups = seedDefaultGroups;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../db/database");
const config_1 = require("../config");
function findUserByEmail(email) {
    return (0, database_1.getRepository)().findUserByEmail(email);
}
function findUserById(id) {
    return (0, database_1.getRepository)().findUserById(id);
}
function createUser(email, password, name, role) {
    const repo = (0, database_1.getRepository)();
    const hash = bcryptjs_1.default.hashSync(password, 10);
    const id = repo.nextId('users');
    const user = {
        id,
        email,
        password_hash: hash,
        name,
        role,
        created_at: new Date().toISOString(),
    };
    repo.insertUser(user);
    return id;
}
function verifyPassword(user, password) {
    return bcryptjs_1.default.compareSync(password, user.password_hash);
}
function signToken(user) {
    return jsonwebtoken_1.default.sign({ sub: user.id, email: user.email, role: user.role, name: user.name }, config_1.config.jwtSecret, { expiresIn: '7d' });
}
function toAuthUser(user) {
    return { id: user.id, email: user.email, name: user.name, role: user.role };
}
function seedDefaultUsers() {
    if ((0, database_1.getRepository)().countUsers() > 0) {
        return;
    }
    const users = [
        ['admin@institute.local', 'admin123', 'Institute Admin', 'admin'],
        ['clerk@institute.local', 'clerk123', 'Admission Clerk', 'admission_clerk'],
        ['teacher@institute.local', 'teacher123', 'Class Teacher', 'teacher'],
    ];
    for (const [email, password, name, role] of users) {
        createUser(email, password, name, role);
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
            name,
            description: desc,
            is_default: isDefault,
            client_id: null,
            created_at: new Date().toISOString(),
        });
    }
}
