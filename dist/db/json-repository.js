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
const EMPTY_DB = {
    users: [],
    studentGroups: [],
    students: [],
    studentActivities: [],
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
        const raw = fs_1.default.readFileSync(this.filePath, 'utf-8');
        this.cache = { ...EMPTY_DB, ...JSON.parse(raw) };
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
    findUserByEmail(email) {
        return this.load().users.find((user) => user.email === email);
    }
    findUserById(id) {
        return this.load().users.find((user) => user.id === id);
    }
    insertUser(user) {
        this.load().users.push(user);
        this.save();
    }
    countUsers() {
        return this.load().users.length;
    }
    listGroups() {
        return [...this.load().studentGroups].sort((a, b) => a.name.localeCompare(b.name));
    }
    listGroupsCreatedSince(since) {
        const sinceTime = since.getTime();
        return this.load().studentGroups.filter((group) => new Date(group.created_at).getTime() > sinceTime);
    }
    insertGroup(group) {
        this.load().studentGroups.push(group);
        this.save();
    }
    deleteGroup(id) {
        const db = this.load();
        const group = db.studentGroups.find((item) => item.id === id);
        if (!group || group.is_default) {
            return false;
        }
        db.studentGroups = db.studentGroups.filter((item) => item.id !== id);
        this.save();
        return true;
    }
    findGroupById(id) {
        return this.load().studentGroups.find((group) => group.id === id);
    }
    countGroups() {
        return this.load().studentGroups.length;
    }
    listStudents(groupId) {
        const students = [...this.load().students].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        if (groupId) {
            return students.filter((student) => student.group_id === groupId);
        }
        return students;
    }
    listStudentsUpdatedSince(since) {
        const sinceTime = since.getTime();
        return this.load().students.filter((student) => new Date(student.updated_at).getTime() > sinceTime);
    }
    getStudentById(id) {
        return this.load().students.find((student) => student.id === id);
    }
    getStudentByClientId(clientId) {
        return this.load().students.find((student) => student.client_id === clientId);
    }
    insertStudent(student) {
        this.load().students.push(student);
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
        this.save();
        return true;
    }
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
}
exports.JsonRepository = JsonRepository;
function createJsonRepository() {
    return new JsonRepository(config_1.config.dbPath);
}
