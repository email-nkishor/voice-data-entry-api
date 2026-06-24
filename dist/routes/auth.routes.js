"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_service_1 = require("../services/auth.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.post('/login', (req, res) => {
    (0, auth_service_1.seedDefaultUsers)();
    (0, auth_service_1.seedDefaultGroups)();
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
    }
    const user = (0, auth_service_1.findUserByEmail)(email.trim().toLowerCase());
    if (!user || !(0, auth_service_1.verifyPassword)(user, password)) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
    }
    const authUser = (0, auth_service_1.toAuthUser)(user);
    const token = (0, auth_service_1.signToken)(authUser);
    res.json({ token, user: authUser });
});
router.get('/me', auth_middleware_1.authMiddleware, (req, res) => {
    res.json({ user: req.user });
});
exports.default = router;
