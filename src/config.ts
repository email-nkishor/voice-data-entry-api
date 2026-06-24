import dotenv from 'dotenv';
import path from 'path';
import { DbDriver } from './db/repository';

dotenv.config();

function resolveDbDriver(): DbDriver {
  const raw = (process.env.DB_DRIVER ?? 'json').toLowerCase();
  if (raw === 'sqlite' || raw === 'sql') {
    return 'sqlite';
  }
  return 'json';
}

const dbDriver = resolveDbDriver();

export const config = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  dbDriver,
  dbPath:
    process.env.DB_PATH ||
    (dbDriver === 'sqlite'
      ? path.join(__dirname, '../data/institute.sqlite')
      : path.join(__dirname, '../data/institute.db')),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:4200',
};
