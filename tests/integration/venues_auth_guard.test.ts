import assert from 'node:assert/strict';

// tests/integration/venues_auth_guard.test.ts
// Integration test (in-process) for venues routes auth guard.
// Run with: npx tsx tests/integration/venues_auth_guard.test.ts

async function importFresh<T = any>(modulePath: string): Promise<T> {
  return (await import(`${modulePath}?t=${Date.now()}-${Math.random()}`)) as any;
}

async function buildFastifyWithRoutes() {
  const fastifyModule = await importFresh<any>('fastify');
  const fastify = fastifyModule.default({ logger: false });

  const routesMod = await importFresh<any>('../../app/backend/routes/venues.ts');
  const venuesRoutes: (f: any) => Promise<void> = routesMod.default;
  await fastify.register(venuesRoutes);

  return fastify;
}

async function main() {
  process.env.APP_JWT_SECRET = 'test-secret';

  const fastify = await buildFastifyWithRoutes();

  // Case 1: Missing auth => 401
  {
    const res = await fastify.inject({ method: 'GET', url: '/api/venues' });
    assert.equal(res.statusCode, 401, `expected 401, got ${res.statusCode}. body=${res.body}`);
    const body = JSON.parse(res.body);
    assert.equal(body?.error, 'unauthorized');
  }

  await fastify.close();
  console.log('PASS: venues auth guard integration test passed');
  process.exit(0);
}

main().catch(async (err) => {
  console.error('FAIL: venues auth guard integration test failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});
