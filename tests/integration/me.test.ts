import assert from 'node:assert/strict';

// tests/integration/me.test.ts
// Integration test (in-process) for GET /api/me
// Run with: npx tsx tests/integration/me.test.ts

async function importFresh<T = any>(modulePath: string): Promise<T> {
  return (await import(`${modulePath}?t=${Date.now()}-${Math.random()}`)) as any;
}

async function buildFastifyWithRoutes() {
  const fastifyModule = await importFresh<any>('fastify');
  const fastify = fastifyModule.default({ logger: false });

  const routesMod = await importFresh<any>('../../app/backend/routes/me.ts');
  const meRoutes: (f: any) => Promise<void> = routesMod.default;
  await fastify.register(meRoutes);

  return fastify;
}

async function main() {
  process.env.APP_JWT_SECRET = 'test-secret';

  const jwtMod = await importFresh<any>('../../app/backend/lib/jwt.ts');
  const signJwt: (payload: any, secret: string) => string = jwtMod.signJwt;

  const fastify = await buildFastifyWithRoutes();

  // Case 1: Missing auth => 401
  {
    const res = await fastify.inject({ method: 'GET', url: '/api/me' });
    assert.equal(res.statusCode, 401, `expected 401, got ${res.statusCode}. body=${res.body}`);
    const body = JSON.parse(res.body);
    assert.equal(body?.error, 'unauthorized');
  }

  // Case 2: Valid bearer token => 200
  {
    const token = signJwt(
      { sub: 'profile-123', email: 'user@example.com', full_name: 'User', avatar_url: 'http://example.com/a.png' },
      'test-secret'
    );

    const res = await fastify.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(res.statusCode, 200, `expected 200, got ${res.statusCode}. body=${res.body}`);
    const body = JSON.parse(res.body);
    assert.equal(body?.id, 'profile-123');
    assert.equal(body?.email, 'user@example.com');
    assert.equal(body?.full_name, 'User');
    assert.equal(body?.avatar_url, 'http://example.com/a.png');
  }

  await fastify.close();
  console.log('PASS: /api/me integration test passed');
  process.exit(0);
}

main().catch(async (err) => {
  console.error('FAIL: /api/me integration test failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});
