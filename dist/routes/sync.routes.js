"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const sync_service_1 = require("../services/sync.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.post('/push', (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items)) {
        res.status(400).json({ error: 'items array is required' });
        return;
    }
    const results = (0, sync_service_1.processSyncPush)(items, req.user?.id);
    const synced = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    res.json({ results, synced, failed, syncedAt: new Date().toISOString() });
});
router.get('/pull', (req, res) => {
    const since = req.query.since;
    res.json((0, sync_service_1.pullChanges)(since));
});
exports.default = router;
