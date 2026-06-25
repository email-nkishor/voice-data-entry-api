"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
exports.getRepository = getRepository;
exports.resetDatabaseForTests = resetDatabaseForTests;
exports.loadDb = loadDb;
exports.saveDb = saveDb;
exports.nextId = nextId;
const config_1 = require("../config");
const json_repository_1 = require("./json-repository");
const sqlite_repository_1 = require("./sqlite-repository");
let repository = null;
function initDatabase() {
    if (repository) {
        return repository;
    }
    repository = config_1.config.dbDriver === 'sqlite' ? (0, sqlite_repository_1.createSqliteRepository)() : (0, json_repository_1.createJsonRepository)();
    console.log(`Database driver: ${repository.driver} (${config_1.config.dbPath})`);
    return repository;
}
function getRepository() {
    if (!repository) {
        return initDatabase();
    }
    return repository;
}
/** Reset singleton between tests (test-only). */
function resetDatabaseForTests() {
    repository = null;
}
/** @deprecated Use getRepository() instead */
function loadDb() {
    throw new Error('loadDb() is removed. Use getRepository() with DB_DRIVER=json|sqlite.');
}
/** @deprecated Use getRepository() instead */
function saveDb() {
    throw new Error('saveDb() is removed. Use getRepository() with DB_DRIVER=json|sqlite.');
}
/** @deprecated Use getRepository() instead */
function nextId() {
    throw new Error('nextId() is removed. Use getRepository().nextId().');
}
