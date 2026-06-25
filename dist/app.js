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
const custom_field_service_1 = require("./services/custom-field.service");
const certificate_template_service_1 = require("./services/certificate-template.service");
const seed_demo_data_service_1 = require("./services/seed-demo-data.service");
const parent_entity_service_1 = require("./services/parent-entity.service");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const organizations_routes_1 = __importDefault(require("./routes/organizations.routes"));
const users_routes_1 = __importDefault(require("./routes/users.routes"));
const students_routes_1 = __importDefault(require("./routes/students.routes"));
const student_groups_routes_1 = __importDefault(require("./routes/student-groups.routes"));
const events_routes_1 = __importDefault(require("./routes/events.routes"));
const attendance_routes_1 = __importDefault(require("./routes/attendance.routes"));
const custom_fields_routes_1 = __importDefault(require("./routes/custom-fields.routes"));
const certificate_templates_routes_1 = __importDefault(require("./routes/certificate-templates.routes"));
const certificates_routes_1 = __importDefault(require("./routes/certificates.routes"));
const awards_routes_1 = __importDefault(require("./routes/awards.routes"));
const voice_entries_routes_1 = __importDefault(require("./routes/voice-entries.routes"));
const reports_routes_1 = __importDefault(require("./routes/reports.routes"));
const parent_routes_1 = __importDefault(require("./routes/parent.routes"));
const sync_routes_1 = __importDefault(require("./routes/sync.routes"));
const speech_routes_1 = __importDefault(require("./routes/speech.routes"));
const lookups_routes_1 = __importDefault(require("./routes/lookups.routes"));
function createApp() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)({
        origin(origin, callback) {
            if ((0, config_1.isCorsOriginAllowed)(origin)) {
                callback(null, origin ?? true);
            }
            else {
                console.warn(`CORS blocked origin: ${origin}`);
                callback(null, false);
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
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
    app.use('/api/organizations', organizations_routes_1.default);
    app.use('/api/users', users_routes_1.default);
    app.use('/api/students', students_routes_1.default);
    app.use('/api/student-groups', student_groups_routes_1.default);
    app.use('/api/events', events_routes_1.default);
    app.use('/api/attendance', attendance_routes_1.default);
    app.use('/api/custom-fields', custom_fields_routes_1.default);
    app.use('/api/certificate-templates', certificate_templates_routes_1.default);
    app.use('/api/certificates', certificates_routes_1.default);
    app.use('/api/awards', awards_routes_1.default);
    app.use('/api/voice-entries', voice_entries_routes_1.default);
    app.use('/api/reports', reports_routes_1.default);
    app.use('/api/parent', parent_routes_1.default);
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
    (0, custom_field_service_1.seedDefaultCustomFields)();
    (0, certificate_template_service_1.seedDefaultTemplates)();
    (0, auth_service_1.seedDemoStudentAndLinks)();
    (0, seed_demo_data_service_1.seedRichDemoData)();
    (0, parent_entity_service_1.syncParentEntitiesFromUserLinks)();
}
