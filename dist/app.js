"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
exports.bootstrap = bootstrap;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const config_1 = require("./config");
const auth_service_1 = require("./services/auth.service");
const lookups_service_1 = require("./services/lookups.service");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const students_routes_1 = __importDefault(require("./routes/students.routes"));
const student_groups_routes_1 = __importDefault(require("./routes/student-groups.routes"));
const sync_routes_1 = __importDefault(require("./routes/sync.routes"));
const speech_routes_1 = __importDefault(require("./routes/speech.routes"));
const lookups_routes_1 = __importDefault(require("./routes/lookups.routes"));
function createApp() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)({
        origin: config_1.config.corsOrigin,
        credentials: true,
    }));
    app.use(express_1.default.json({ limit: '2mb' }));
    app.get('/api/health', (_req, res) => {
        res.json({
            status: 'ok',
            dbDriver: config_1.config.dbDriver,
            timestamp: new Date().toISOString(),
        });
    });
    app.use('/api/auth', auth_routes_1.default);
    app.use('/api/students', students_routes_1.default);
    app.use('/api/student-groups', student_groups_routes_1.default);
    app.use('/api/sync', sync_routes_1.default);
    app.use('/api/speech', speech_routes_1.default);
    app.use('/api/lookups', lookups_routes_1.default);
    app.use((_req, res) => {
        res.status(404).json({ error: 'Not found' });
    });
    return app;
}
function bootstrap() {
    (0, auth_service_1.seedDefaultUsers)();
    (0, auth_service_1.seedDefaultGroups)();
    (0, lookups_service_1.seedDefaultLookups)();
}
