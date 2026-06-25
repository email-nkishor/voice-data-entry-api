"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_service_1 = require("../services/auth.service");
const seed_demo_data_service_1 = require("../services/seed-demo-data.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const audit_service_1 = require("../services/audit.service");
const organization_service_1 = require("../services/organization.service");
const router = (0, express_1.Router)();
router.post('/login', (req, res) => {
    (0, auth_service_1.seedDefaultUsers)();
    (0, auth_service_1.ensureDefaultUsers)();
    (0, auth_service_1.seedDefaultGroups)();
    (0, auth_service_1.seedDemoStudentAndLinks)();
    (0, seed_demo_data_service_1.seedRichDemoData)();
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
    }
    const user = (0, auth_service_1.findUserByEmail)(email.trim().toLowerCase());
    if (!user || user.status !== 'active' || !(0, auth_service_1.verifyPassword)(user, password)) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
    }
    const authUser = (0, auth_service_1.toAuthUser)(user);
    const token = (0, auth_service_1.signToken)(authUser);
    if (authUser.role === 'parent' && (0, organization_service_1.isParentPortalEnabled)(authUser.organizationId)) {
        (0, audit_service_1.logAudit)('parent', authUser.id, 'parent_login', { email: authUser.email }, authUser.id, authUser.organizationId);
    }
    res.json({
        token,
        user: authUser,
        parentPortalEnabled: (0, organization_service_1.isParentPortalEnabled)(authUser.organizationId),
        parentAttendanceEnabled: (0, organization_service_1.isParentAttendanceEnabled)(authUser.organizationId),
    });
});
router.get('/me', auth_middleware_1.authMiddleware, (req, res) => {
    if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    const user = (0, auth_service_1.findUserByEmail)(req.user.email);
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    res.json({ user: (0, auth_service_1.toAuthUser)(user) });
});
exports.default = router;
