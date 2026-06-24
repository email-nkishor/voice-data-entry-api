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

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'https://voice-data-entry-web.vercel.app',
];

function resolveCorsOrigins(): string[] {
  const fromEnv = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [];

  return [...new Set([...DEFAULT_CORS_ORIGINS, ...fromEnv])];
}

const corsOrigins = resolveCorsOrigins();

/** Allows configured origins, any *.vercel.app preview URL, and local dev ports. */
export function isCorsOriginAllowed(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }

  if (corsOrigins.includes(origin)) {
    return true;
  }

  if (/^https:\/\/[\w-]+\.vercel\.app$/.test(origin)) {
    return true;
  }

  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
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
  corsOrigins,
};
