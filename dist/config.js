"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
function resolveDbDriver() {
    const raw = (process.env.DB_DRIVER ?? 'json').toLowerCase();
    if (raw === 'sqlite' || raw === 'sql') {
        return 'sqlite';
    }
    return 'json';
}
const dbDriver = resolveDbDriver();
exports.config = {
    port: Number(process.env.PORT) || 3000,
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    dbDriver,
    dbPath: process.env.DB_PATH ||
        (dbDriver === 'sqlite'
            ? path_1.default.join(__dirname, '../data/institute.sqlite')
            : path_1.default.join(__dirname, '../data/institute.db')),
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:4200',
};
