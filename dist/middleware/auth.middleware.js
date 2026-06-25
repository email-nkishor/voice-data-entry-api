"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.requireRoles = requireRoles;
exports.requirePermission = requirePermission;
exports.requireAnyPermission = requireAnyPermission;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const permission_service_1 = require("../services/permission.service");
function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    const token = header.slice(7);
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwtSecret);
        req.user = {
            id: Number(decoded.sub ?? decoded.id),
            email: String(decoded.email),
            name: String(decoded.name),
            role: decoded.role,
            organizationId: decoded.organizationId ?? 1,
            permissions: decoded.permissions ?? [],
            linkedStudentIds: decoded.linkedStudentIds ?? [],
        };
        next();
    }
    catch {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}
function requireRoles(...roles) {
    const expanded = new Set(roles);
    if (roles.includes('clerk')) {
        expanded.add('admission_clerk');
    }
    if (roles.includes('admission_clerk')) {
        expanded.add('clerk');
    }
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        if (!expanded.has(req.user.role)) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
        next();
    };
}
function requirePermission(module, action) {
    return requireAnyPermission({ module, action });
}
function requireAnyPermission(...checks) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const allowed = checks.some((check) => (0, permission_service_1.userHasPermission)(req.user, check.module, check.action));
        if (!allowed) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
        next();
    };
}
