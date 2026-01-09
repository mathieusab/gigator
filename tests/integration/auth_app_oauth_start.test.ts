import assert from 'node:assert/strict';

// tests/integration/auth_app_oauth_start.test.ts
// Integration test (in-process) for POST /api/auth/google/start
// Run with: npx tsx tests/integration/auth_app_oauth_start.test.ts

async function importFresh<T = any>(modulePath: string): Promise<T> {
  // Cache-bust to allow multiple env configurations in one process.
  return (await import(`${modulePath}?t=${Date.now()}-${Math.random()}`)) as any;
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
  // Common env for these tests
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_APP_OAUTH_REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';

  // Force in-memory oauth state store (avoid Redis connect in tests).
  process.env.REDIS_URL = '';
  process.env.OAUTH_STATE_TTL = '600';

  // Ensure any pg usage does not attempt real connection in these tests.
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:pass@127.0.0.1:5432/db';

  // Case 1: Start OK - minimal scopes only
  {
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

    const fastify = await buildFastifyWithRoutes();

    const res = await fastify.inject({
      method: 'POST',
      url: '/api/auth/google/start'
    });

    assert.equal(res.statusCode, 200, `expected 200, got ${res.statusCode}. body=${res.body}`);

    let body: any;
    try {
      body = JSON.parse(res.body);
    } catch {
      throw new Error(`response is not valid JSON: ${res.body}`);
    }

    const oauthUrl = body?.oauth_url;
    assert.equal(typeof oauthUrl, 'string', 'oauth_url missing or not a string in response body');

    const expectedPrefix = 'https://accounts.google.com/o/oauth2/v2/auth?';
    assert.ok(
      oauthUrl.startsWith(expectedPrefix),
      `oauth_url does not start with expected prefix. got: ${oauthUrl}`
    );

    const u = new URL(oauthUrl);

    assert.equal(u.searchParams.get('client_id'), 'test-client-id', 'client_id param mismatch');
    assert.equal(
      u.searchParams.get('redirect_uri'),
      'http://localhost:3000/api/auth/google/callback',
      'redirect_uri param mismatch'
    );
    assert.equal(u.searchParams.get('response_type'), 'code', 'response_type should be code');

    const scope = u.searchParams.get('scope') || '';
    assert.ok(scope.includes('openid'), 'scope should include openid');
    assert.ok(scope.includes('email'), 'scope should include email');
    assert.ok(scope.includes('profile'), 'scope should include profile');
    assert.ok(
      !scope.includes('https://www.googleapis.com/auth/gmail.readonly'),
      'scope must NOT include gmail.readonly'
    );

    const state = u.searchParams.get('state');
    assert.ok(state, 'state param missing');
    assert.match(state!, /^[0-9a-f]{48}$/i, 'state should look like 24 random bytes hex');

    await fastify.close();
  }

  // Case 2: Missing config => 400 oauth_config_error
  {
    delete process.env.GOOGLE_CLIENT_SECRET;

    const fastify = await buildFastifyWithRoutes();

    const res = await fastify.inject({
      method: 'POST',
      url: '/api/auth/google/start'
    });

    assert.equal(res.statusCode, 400, `expected 400, got ${res.statusCode}. body=${res.body}`);
    const body = JSON.parse(res.body);
    assert.equal(body?.error, 'oauth_config_error');

    await fastify.close();
  }

  console.log('PASS: /api/auth/google/start in-process integration test passed');
  process.exit(0);
}

main().catch(async (err) => {
  console.error('FAIL: /api/auth/google/start in-process integration test failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});
