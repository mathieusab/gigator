import assert from 'node:assert/strict';

// tests/integration/auth_app_oauth_deny_allowlist_inactive.test.ts
// Integration test (in-process) for DB allowlist inactive => 403 access_denied
// Run with: npx tsx tests/integration/auth_app_oauth_deny_allowlist_inactive.test.ts

async function importFresh<T = any>(modulePath: string): Promise<T> {
  return (await import(`${modulePath}?t=${Date.now()}-${Math.random()}`)) as any;
}

function setTestEnv() {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.GOOGLE_APP_OAUTH_REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';

  process.env.APP_JWT_SECRET = 'test-app-jwt-secret';

  // Force in-memory oauth state store
  process.env.REDIS_URL = '';
  process.env.OAUTH_STATE_TTL = '600';

  // Ensure allowlist is checked via DB (env allowlist unset)
  delete process.env.APP_EMAIL_ALLOWLIST;

  // Required by controller (but we stub pg connect/query)
  process.env.DATABASE_URL = 'postgres://user:pass@127.0.0.1:5432/db';
}

function stubFetch() {
  const originalFetch = (globalThis as any).fetch;

  (globalThis as any).fetch = async (url: any) => {
    const u = String(url);
    if (u.includes('oauth2.googleapis.com/token') || u.includes('/token')) {
      return {
        ok: true,
        status: 200,
        async json() {
          return { access_token: 'ACCESS_TOKEN_FOR_TEST' };
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
            email: 'inactive@example.com',
            name: 'Inactive User',
            picture: 'http://example.com/avatar.png'
          };
        }
      } as any;
    }

    return { ok: false, status: 500, async json() { return {}; } } as any;
  };

  return () => {
    (globalThis as any).fetch = originalFetch;
  };
}

async function stubPgConnect() {
  const pgMod = await importFresh<any>('pg');
  const Pool = pgMod.Pool;
  const originalConnect = Pool.prototype.connect;

  Pool.prototype.connect = async function () {
    return {
      async query(sql: string) {
        if (sql.includes('FROM app_email_allowlist')) {
          return { rows: [{ is_active: false }] };
        }
        return { rows: [] };
      },
      release() {}
    };
  };

  return () => {
    Pool.prototype.connect = originalConnect;
  };
}

async function buildFastifyWithRoutes() {
  const fastifyModule = await importFresh<any>('fastify');
  const fastify = fastifyModule.default({ logger: false });

  const routesMod = await importFresh<any>('../../app/backend/routes/auth_app_google.ts');
  const authAppGoogleRoutes: (f: any) => Promise<void> = routesMod.default;
  await fastify.register(authAppGoogleRoutes);

  return fastify;
}

async function main() {
  setTestEnv();
  const restoreFetch = stubFetch();
  const restorePg = await stubPgConnect();

  try {
    const storeMod = await importFresh<any>('../../app/backend/lib/oauth_state_store.ts');
    const persistOauthState: (state: string, meta: any, ttlSeconds?: number) => Promise<void> =
      storeMod.persistOauthState;

    const state = 'c'.repeat(48);
    await persistOauthState(state, { created_at: new Date().toISOString(), flow: 'app_login' }, 600);

    const fastify = await buildFastifyWithRoutes();

    const res = await fastify.inject({
      method: 'GET',
      url: `/api/auth/google/callback?code=FAKE_CODE&state=${state}`
    });

    assert.equal(res.statusCode, 403, `expected 403, got ${res.statusCode}. body=${res.body}`);
    const body = JSON.parse(res.body);
    assert.equal(body?.error, 'access_denied');

    await fastify.close();

    console.log('PASS: allowlist inactive integration test passed');
    process.exit(0);
  } finally {
    restoreFetch();
    restorePg();
  }
}

main().catch((err) => {
  console.error('FAIL: allowlist inactive integration test failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});
