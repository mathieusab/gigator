import assert from 'node:assert/strict';

// tests/integration/oauth_callback_happy_path.test.ts
// Integration test (in-process) for successful GET /api/sync/gmail/callback
// Run with: npx tsx tests/integration/oauth_callback_happy_path.test.ts

async function importFresh<T = any>(modulePath: string): Promise<T> {
  return (await import(`${modulePath}?t=${Date.now()}-${Math.random()}`)) as any;
}

function setTestEnv() {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.GOOGLE_OAUTH_REDIRECT_URI = 'http://localhost:3000/api/sync/gmail/callback';

  process.env.ENABLE_GMAIL_OAUTH_CALLBACK = 'true';

  // Force in-memory oauth state store
  process.env.REDIS_URL = '';
  process.env.OAUTH_STATE_TTL = '600';

  // Required by controller (but we stub pg connect/query)
  process.env.DATABASE_URL = 'postgres://user:pass@127.0.0.1:5432/db';
}

function stubFetch() {
  const originalFetch = (globalThis as any).fetch;

  const TOKEN_URL = process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';

  (globalThis as any).fetch = async (url: any, init?: any) => {
    const u = String(url);

    if (u === TOKEN_URL || u.includes('/token')) {
      // Ensure we never accidentally log tokens: this just returns them.
      assert.equal(init?.method, 'POST');
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            access_token: 'ACCESS_TOKEN_FOR_TEST',
            refresh_token: 'REFRESH_TOKEN_FOR_TEST',
            expires_in: 3600,
            scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
            token_type: 'Bearer',
            id_token: 'ID_TOKEN_FOR_TEST'
          };
        }
      } as any;
    }

    if (u.includes('www.googleapis.com/oauth2/v3/userinfo')) {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            sub: 'google-sub-123',
            email: 'tester@example.com',
            name: 'Tester Example'
          };
        }
      } as any;
    }

    return {
      ok: false,
      status: 500,
      async json() {
        return {};
      }
    } as any;
  };

  return () => {
    (globalThis as any).fetch = originalFetch;
  };
}

async function stubPgConnect() {
  const queries: Array<{ sql: string; params?: any[] }> = [];

  const pgMod = await importFresh<any>('pg');
  const Pool = pgMod.Pool;
  const originalConnect = Pool.prototype.connect;

  Pool.prototype.connect = async function () {
    return {
      async query(sql: string, params?: any[]) {
        queries.push({ sql: String(sql), params });
        const q = String(sql).toLowerCase();

        if (q.trim() === 'begin' || q.trim() === 'commit' || q.trim() === 'rollback') {
          return { rowCount: 0, rows: [] };
        }

        if (q.includes('insert into gmail_accounts')) {
          // RETURNING id, google_user_id, email, display_name, expires_at, scope;
          return {
            rowCount: 1,
            rows: [
              {
                id: 'acct-1',
                google_user_id: params?.[1] ?? 'google-sub-123',
                email: params?.[2] ?? 'tester@example.com',
                display_name: params?.[3] ?? 'Tester Example',
                expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
                scope: params?.[6] ?? 'openid email profile https://www.googleapis.com/auth/gmail.readonly'
              }
            ]
          };
        }

        if (q.includes('insert into gmail_import_runs')) {
          return { rowCount: 1, rows: [{ id: 'run-1', started_at: new Date().toISOString() }] };
        }

        throw new Error(`unexpected_sql_in_test: ${q.slice(0, 120)}`);
      },
      release() {}
    };
  };

  return {
    queries,
    restore() {
      Pool.prototype.connect = originalConnect;
    }
  };
}

async function buildFastifyWithRoutes() {
  const fastifyModule = await importFresh<any>('fastify');
  const fastify = fastifyModule.default({ logger: false });

  const routesMod = await importFresh<any>('../../app/backend/routes/auth_google.ts');
  const authGoogleRoutes: (f: any) => Promise<void> = routesMod.default;
  await fastify.register(authGoogleRoutes);

  return fastify;
}

async function main() {
  setTestEnv();
  const restoreFetch = stubFetch();
  const pg = await stubPgConnect();

  try {
    const storeMod = await importFresh<any>('../../app/backend/lib/oauth_state_store.ts');
    const persistOauthState: (state: string, meta: any, ttlSeconds?: number) => Promise<void> =
      storeMod.persistOauthState;

    const state = 'c'.repeat(48);
    await persistOauthState(state, { created_at: new Date().toISOString(), flow: 'gmail' }, 600);

    const fastify = await buildFastifyWithRoutes();

    const res = await fastify.inject({
      method: 'GET',
      url: `/api/sync/gmail/callback?code=FAKE_CODE&state=${state}`
    });

    assert.equal(res.statusCode, 200, `expected 200, got ${res.statusCode}. body=${res.body}`);
    const body = JSON.parse(res.body);

    // AC1: response is sanitized and contains only safe fields
    assert.deepEqual(Object.keys(body).sort(), ['display_name', 'email', 'expires_at', 'id']);
    assert.equal(body?.id, 'acct-1');
    assert.equal(body?.email, 'tester@example.com');
    assert.equal(body?.display_name, 'Tester Example');
    assert.ok(body?.expires_at, 'expires_at missing');
    assert.equal((body as any).refresh_token, undefined);
    assert.equal((body as any).access_token, undefined);

    // AC2: import run row is created with status = created
    const importRunQuery = pg.queries.find((q) => q.sql.toLowerCase().includes('insert into gmail_import_runs'));
    assert.ok(importRunQuery, 'expected gmail_import_runs insert query');
    assert.equal(importRunQuery?.params?.[1], 'created');

    await fastify.close();

    console.log('PASS: /api/sync/gmail/callback happy path integration test passed');
    process.exit(0);
  } finally {
    restoreFetch();
    pg.restore();
  }
}

main().catch(async (err) => {
  console.error('FAIL: /api/sync/gmail/callback happy path integration test failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});
