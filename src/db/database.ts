import { config } from '../config';
import { createJsonRepository } from './json-repository';
import { DbRepository } from './repository';
import { createSqliteRepository } from './sqlite-repository';

let repository: DbRepository | null = null;

export function initDatabase(): DbRepository {
  if (repository) {
    return repository;
  }

  repository = config.dbDriver === 'sqlite' ? createSqliteRepository() : createJsonRepository();
  console.log(`Database driver: ${repository.driver} (${config.dbPath})`);
  return repository;
}

export function getRepository(): DbRepository {
  if (!repository) {
    return initDatabase();
  }
  return repository;
}

/** @deprecated Use getRepository() instead */
export function loadDb() {
  throw new Error('loadDb() is removed. Use getRepository() with DB_DRIVER=json|sqlite.');
}

/** @deprecated Use getRepository() instead */
export function saveDb() {
  throw new Error('saveDb() is removed. Use getRepository() with DB_DRIVER=json|sqlite.');
}

/** @deprecated Use getRepository() instead */
export function nextId() {
  throw new Error('nextId() is removed. Use getRepository().nextId().');
}
