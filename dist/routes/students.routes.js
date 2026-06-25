"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const student_service_1 = require("../services/student.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get('/stats', (req, res) => {
    const groupId = req.query.groupId ? Number(req.query.groupId) : undefined;
    const stats = (0, student_service_1.getDashboardStats)(groupId);
    res.json(stats);
});
router.get('/activities', (req, res) => {
    const studentId = req.query.studentId ? Number(req.query.studentId) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    res.json((0, student_service_1.listActivities)(studentId, limit));
});
router.get('/', (req, res) => {
    const groupId = req.query.groupId ? Number(req.query.groupId) : undefined;
    const students = (0, student_service_1.listStudents)(groupId).map((s) => (0, student_service_1.studentToApi)(s));
    res.json(students);
});
router.get('/:id', (req, res) => {
    const student = (0, student_service_1.getStudentById)(Number(req.params.id));
    if (!student) {
        res.status(404).json({ error: 'Student not found' });
        return;
    }
    res.json((0, student_service_1.studentToApi)(student, true));
});
router.post('/', (0, auth_middleware_1.requireRoles)('admin', 'admission_clerk'), (req, res) => {
    const input = (0, student_service_1.apiToStudentInput)(req.body);
    if (!input.name?.trim()) {
        res.status(400).json({ error: 'Name is required' });
        return;
    }
    const created = (0, student_service_1.createStudent)(input, req.user?.id);
    res.status(201).json((0, student_service_1.studentToApi)(created));
});
router.put('/:id', (0, auth_middleware_1.requireRoles)('admin', 'admission_clerk'), (req, res) => {
    const id = Number(req.params.id);
    const input = (0, student_service_1.apiToStudentInput)(req.body);
    const updated = (0, student_service_1.updateStudent)(id, input, req.user?.id);
    if (!updated) {
        res.status(404).json({ error: 'Student not found' });
        return;
    }
    res.json((0, student_service_1.studentToApi)(updated));
});
router.delete('/:id', (0, auth_middleware_1.requireRoles)('admin'), (req, res) => {
    const ok = (0, student_service_1.deleteStudent)(Number(req.params.id), req.user?.id);
    if (!ok) {
        res.status(404).json({ error: 'Student not found' });
        return;
    }
    res.json({ success: true });
});
router.post('/:id/approve', (0, auth_middleware_1.requireRoles)('admin', 'admission_clerk'), (req, res) => {
    const updated = (0, student_service_1.approveAdmission)(Number(req.params.id), req.user?.id);
    if (!updated) {
        res.status(404).json({ error: 'Student not found' });
        return;
    }
    res.json((0, student_service_1.studentToApi)(updated));
});
exports.default = router;
