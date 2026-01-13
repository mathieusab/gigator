import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const { Client } = pg;

const dbUrl = process.env.SUPABASE_DB_URL;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function withAuthContext<T>(
  client: pg.Client,
  uid: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await client.query('begin');
  try {
    // Supabase `auth.uid()` reads from `request.jwt.claim.sub`.
    // Using `set_config(..., true)` sets LOCAL (txn-scoped) values.
    await client.query("select set_config('request.jwt.claim.role', $1, true)", ['authenticated']);
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [uid ?? '']);

    const result = await fn();
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback');
    throw err;
  }
}

test('concerts RLS policies enforce active user + creator-only writes', async (t) => {
  if (!dbUrl) {
    t.skip('SUPABASE_DB_URL not set; skipping RLS integration test');
    return;
  }

  const activeUserId = requireEnv('RLS_TEST_ACTIVE_UID');
  const inactiveUserId = requireEnv('RLS_TEST_INACTIVE_UID');

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    // Active user should be able to select (even if empty).
    await withAuthContext(client, activeUserId, async () => {
      await client.query('select * from concerts limit 1');
    });

    // Inactive user should be denied select by RLS.
    await assert.rejects(
      () =>
        withAuthContext(client, inactiveUserId, async () => {
          await client.query('select * from concerts limit 1');
        }),
      /permission denied|violates row-level security|RLS/i,
    );

    // Insert: must be active and created_by = auth.uid().
    await assert.rejects(
      () =>
        withAuthContext(client, activeUserId, async () => {
          await client.query(
            "insert into concerts (venue_name, created_by) values ('Test Venue', $1)",
            ['00000000-0000-0000-0000-000000000000'],
          );
        }),
      /row-level security|RLS|violates/i,
    );
  } finally {
    await client.end();
  }
});
