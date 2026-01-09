// app/backend/lib/db.ts
// Shared Postgres pool (singleton per Node process).

import { Pool } from 'pg';

let pool: Pool | null = null;

export function getDbPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('missing_database_url');
    pool = new Pool({ connectionString: url });
  }
  return pool;
}
