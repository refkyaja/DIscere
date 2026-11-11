import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import { config } from './config.js';

const isPostgres =
  config.databaseUrl.startsWith('postgres://') ||
  config.databaseUrl.startsWith('postgresql://');

const adapter = isPostgres
  ? new PrismaPg(new pg.Pool({ connectionString: config.databaseUrl }))
  : new PrismaBetterSqlite3({ url: config.databaseUrl });

export const prisma = new PrismaClient({ adapter });
