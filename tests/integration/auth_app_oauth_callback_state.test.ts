import assert from 'node:assert/strict';

// tests/integration/auth_app_oauth_callback_state.test.ts
// Integration test (in-process) for GET /api/auth/google/callback state validation
// Run with: npx tsx tests/integration/auth_app_oauth_callback_state.test.ts

async function importFresh<T = any>(modulePath: string): Promise<T> {
  return (await import(`${modulePath}?t=${Date.now()}-${Math.random()}`)) as any;
}

function setTestEnv() {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.GOOGLE_APP_OAUTH_REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';

  process.env.REDIS_URL = '';
  process.env.OAUTH_STATE_TTL = '600';
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:pass@127.0.0.1:5432/db';
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

  const fastify = await buildFastifyWithRoutes();

  // Case 1: Missing state => 400 invalid_oauth_state
  {
    const res = await fastify.inject({
      method: 'GET',
      url: '/api/auth/google/callback?code=FAKE_CODE'
    });

    assert.equal(res.statusCode, 400, `expected 400, got ${res.statusCode}. body=${res.body}`);
    const body = JSON.parse(res.body);
    assert.equal(body?.error, 'invalid_oauth_state');
  }

  // Case 2: Unknown state => 400 invalid_oauth_state
  {
    const res = await fastify.inject({
      method: 'GET',
      url: '/api/auth/google/callback?code=FAKE_CODE&state=unknown_state'
    });

    assert.equal(res.statusCode, 400, `expected 400, got ${res.statusCode}. body=${res.body}`);
    const body = JSON.parse(res.body);
    assert.equal(body?.error, 'invalid_oauth_state');
  }

  await fastify.close();

  console.log('PASS: /api/auth/google/callback state validation test passed');
  process.exit(0);
}

main().catch(async (err) => {
  console.error('FAIL: /api/auth/google/callback state validation test failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});
