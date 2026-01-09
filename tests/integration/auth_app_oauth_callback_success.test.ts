import assert from 'node:assert/strict';

// tests/integration/auth_app_oauth_callback_success.test.ts
// Integration test (in-process) for successful /api/auth/google/callback
// Run with: npx tsx tests/integration/auth_app_oauth_callback_success.test.ts

async function importFresh<T = any>(modulePath: string): Promise<T> {
  return (await import(`${modulePath}?t=${Date.now()}-${Math.random()}`)) as any;
}

function setTestEnv() {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.GOOGLE_APP_OAUTH_REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';

  process.env.APP_JWT_SECRET = 'test-app-jwt-secret';
  process.env.APP_EMAIL_ALLOWLIST = 'allowed@example.com';

  // Force in-memory oauth state store
  process.env.REDIS_URL = '';
  process.env.OAUTH_STATE_TTL = '600';

  // Required by controller (but we stub pg connect/query)
  process.env.DATABASE_URL = 'postgres://user:pass@127.0.0.1:5432/db';
}

function stubFetch() {
  const originalFetch = (globalThis as any).fetch;

  (globalThis as any).fetch = async (url: any, init?: any) => {
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
            email: 'allowed@example.com',
            name: 'Allowed User',
            picture: 'http://example.com/avatar.png'
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
  const pgMod = await importFresh<any>('pg');
  const Pool = pgMod.Pool;
  const originalConnect = Pool.prototype.connect;

  Pool.prototype.connect = async function () {
    return {
      async query(_sql: string, params?: any[]) {
        const email = params?.[0] ?? 'allowed@example.com';
        const fullName = params?.[1] ?? null;
        const avatarUrl = params?.[2] ?? null;
        return {
          rows: [{ id: 'profile-123', email, full_name: fullName, avatar_url: avatarUrl }]
        };
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

    const state = 'b'.repeat(48);
    await persistOauthState(state, { created_at: new Date().toISOString(), flow: 'app_login' }, 600);

    const fastify = await buildFastifyWithRoutes();

    const res = await fastify.inject({
      method: 'GET',
      url: `/api/auth/google/callback?code=FAKE_CODE&state=${state}`
    });

    assert.equal(res.statusCode, 200, `expected 200, got ${res.statusCode}. body=${res.body}`);
    const body = JSON.parse(res.body);
    assert.equal(typeof body?.token, 'string', 'token missing');
    assert.ok(body.token.split('.').length === 3, 'token should look like a JWT');
    assert.equal(body?.profile?.id, 'profile-123');
    assert.equal(body?.profile?.email, 'allowed@example.com');

    await fastify.close();

    console.log('PASS: /api/auth/google/callback success integration test passed');
    process.exit(0);
  } finally {
    restoreFetch();
    restorePg();
  }
}

main().catch(async (err) => {
  console.error('FAIL: /api/auth/google/callback success integration test failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});
