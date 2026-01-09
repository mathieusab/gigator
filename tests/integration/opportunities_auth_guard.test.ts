import assert from 'node:assert/strict';

// tests/integration/opportunities_auth_guard.test.ts
// Integration test (in-process) for opportunities routes auth guard.
// Run with: npx tsx tests/integration/opportunities_auth_guard.test.ts

async function importFresh<T = any>(modulePath: string): Promise<T> {
  return (await import(`${modulePath}?t=${Date.now()}-${Math.random()}`)) as any;
}

async function buildFastifyWithRoutes() {
  const fastifyModule = await importFresh<any>('fastify');
  const fastify = fastifyModule.default({ logger: false });

  const routesMod = await importFresh<any>('../../app/backend/routes/opportunities.ts');
  const opportunitiesRoutes: (f: any) => Promise<void> = routesMod.default;
  await fastify.register(opportunitiesRoutes);

  return fastify;
}

async function main() {
  process.env.APP_JWT_SECRET = 'test-secret';

  const fastify = await buildFastifyWithRoutes();

  // Case 1: Missing auth => 401
  {
    const res = await fastify.inject({ method: 'GET', url: '/api/opportunities' });
    assert.equal(res.statusCode, 401, `expected 401, got ${res.statusCode}. body=${res.body}`);
    const body = JSON.parse(res.body);
    assert.equal(body?.error, 'unauthorized');
  }

  // Case 1b: Missing auth with follow_up filter => 401
  {
    const res = await fastify.inject({ method: 'GET', url: '/api/opportunities?follow_up=due' });
    assert.equal(res.statusCode, 401, `expected 401, got ${res.statusCode}. body=${res.body}`);
    const body = JSON.parse(res.body);
    assert.equal(body?.error, 'unauthorized');
  }

  // Case 2: Invalid token signature => 401
  {
    const jwtMod = await importFresh<any>('../../app/backend/lib/jwt.ts');
    const signJwt: (payload: any, secret: string) => string = jwtMod.signJwt;
    const badToken = signJwt({ sub: 'profile-123', email: 'user@example.com' }, 'wrong-secret');

    const res = await fastify.inject({
      method: 'GET',
      url: '/api/opportunities',
      headers: { authorization: `Bearer ${badToken}` }
    });
    assert.equal(res.statusCode, 401, `expected 401, got ${res.statusCode}. body=${res.body}`);
    const body = JSON.parse(res.body);
    assert.equal(body?.error, 'unauthorized');
  }

  // Case 3: Token missing sub => 401
  {
    const jwtMod = await importFresh<any>('../../app/backend/lib/jwt.ts');
    const signJwt: (payload: any, secret: string) => string = jwtMod.signJwt;
    const tokenMissingSub = signJwt({ email: 'user@example.com' }, 'test-secret');

    const res = await fastify.inject({
      method: 'GET',
      url: '/api/opportunities',
      headers: { authorization: `Bearer ${tokenMissingSub}` }
    });
    assert.equal(res.statusCode, 401, `expected 401, got ${res.statusCode}. body=${res.body}`);
    const body = JSON.parse(res.body);
    assert.equal(body?.error, 'unauthorized');
  }

  await fastify.close();
  console.log('PASS: opportunities auth guard integration test passed');
  process.exit(0);
}

main().catch(async (err) => {
  console.error('FAIL: opportunities auth guard integration test failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});
