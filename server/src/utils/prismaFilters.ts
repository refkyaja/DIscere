import { config } from '../config.js';

/**
 * Mengecek apakah backend berjalan memakai PostgreSQL / Supabase.
 */
export function isPostgresDatabase(): boolean {
  return /^postgres(ql)?:\/\//i.test(config.databaseUrl);
}

/**
 * Menghasilkan filter `contains` Prisma yang aman untuk SQLite dan PostgreSQL.
 * PostgreSQL memakai `mode: 'insensitive'`, sedangkan SQLite tidak mendukung argumen `mode`.
 */
export function containsInsensitive(query: string): { contains: string } {
  return (
    isPostgresDatabase()
      ? { contains: query, mode: 'insensitive' }
      : { contains: query }
  ) as { contains: string };
}

