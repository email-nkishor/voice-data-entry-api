"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const student_service_1 = require("../services/student.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get('/', (_req, res) => {
    const groups = (0, student_service_1.listGroups)().map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        isDefault: !!g.is_default,
        clientId: g.client_id,
        createdDate: g.created_at,
    }));
    res.json(groups);
});
router.post('/', (0, auth_middleware_1.requirePermission)('group', 'create'), (req, res) => {
    const { name, description, clientId } = req.body;
    if (!name?.trim()) {
        res.status(400).json({ error: 'Group name is required' });
        return;
    }
    const created = (0, student_service_1.createGroup)(name.trim(), description?.trim(), clientId);
    res.status(201).json({
        id: created.id,
        name: created.name,
        description: created.description,
        isDefault: !!created.is_default,
        clientId: created.client_id,
        createdDate: created.created_at,
    });
});
router.put('/:id', (0, auth_middleware_1.requirePermission)('group', 'modify'), (req, res) => {
    const { name, description } = req.body;
    if (!name?.trim()) {
        res.status(400).json({ error: 'Group name is required' });
        return;
    }
    const updated = (0, student_service_1.updateGroup)(Number(req.params.id), name.trim(), description?.trim());
    if (!updated) {
        res.status(404).json({ error: 'Group not found' });
        return;
    }
    res.json({
        id: updated.id,
        name: updated.name,
        description: updated.description,
        isDefault: !!updated.is_default,
        clientId: updated.client_id,
        createdDate: updated.created_at,
    });
});
router.post('/:id/assign-students', (0, auth_middleware_1.requirePermission)('group', 'assign'), (req, res) => {
    const { studentIds } = req.body;
    if (!studentIds?.length) {
        res.status(400).json({ error: 'studentIds array is required' });
        return;
    }
    const count = (0, student_service_1.assignStudentsToGroup)(Number(req.params.id), studentIds, req.user?.id);
    res.json({ success: true, assignedCount: count });
});
router.delete('/:id', (0, auth_middleware_1.requireRoles)('admin'), (req, res) => {
    const ok = (0, student_service_1.deleteGroup)(Number(req.params.id));
    if (!ok) {
        res.status(400).json({ error: 'Group not found or is default' });
        return;
    }
    res.json({ success: true });
});
exports.default = router;
