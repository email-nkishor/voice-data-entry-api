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

function resolveCorsOrigins(): string[] {
  if (process.env.CORS_ORIGIN) {
    return process.env.CORS_ORIGIN.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  return ['http://localhost:4200', 'https://your-project.vercel.app'];
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  dbDriver,
  dbPath:
    process.env.DB_PATH ||
    (dbDriver === 'sqlite'
      ? path.join(__dirname, '../data/institute.sqlite')
      : path.join(__dirname, '../data/institute.db')),
  corsOrigins: resolveCorsOrigins(),
};
