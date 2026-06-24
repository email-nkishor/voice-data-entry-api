"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const lookups_service_1 = require("../services/lookups.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get('/', (_req, res) => {
    res.json((0, lookups_service_1.getAllLookups)());
});
router.get('/:category', (req, res) => {
    const options = (0, lookups_service_1.getLookupCategory)(req.params.category);
    if (!options) {
        res.status(404).json({ error: 'Unknown lookup category' });
        return;
    }
    res.json(options);
});
exports.default = router;
