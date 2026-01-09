import assert from 'node:assert/strict';

// tests/integration/activity_log_auth_guard.test.ts
// Auth guard test for activity log routes.
// Run with: npx tsx tests/integration/activity_log_auth_guard.test.ts

async function importFresh<T = any>(modulePath: string): Promise<T> {
  return (await import(`${modulePath}?t=${Date.now()}-${Math.random()}`)) as any;
}

async function buildFastifyWithRoutes() {
  const fastifyModule = await importFresh<any>('fastify');
  const fastify = fastifyModule.default({ logger: false });

  // Inject a fake dbPool so routes don't touch real Postgres.
  fastify.decorate('dbPool', {
    async connect() {
      return {
        async query() {
          throw new Error('should_not_query');
        },
        release() {}
      };
    }
  });

  const routesMod = await importFresh<any>('../../app/backend/routes/activity_log.ts');
  const routes: (f: any) => Promise<void> = routesMod.default;
  await fastify.register(routes);

  return fastify;
}

async function main() {
  process.env.APP_JWT_SECRET = 'test-secret';

  const fastify = await buildFastifyWithRoutes();

  // Missing auth => 401 (GET)
  {
    const res = await fastify.inject({ method: 'GET', url: '/api/opportunities/opp-1/activity' });
    assert.equal(res.statusCode, 401, `expected 401, got ${res.statusCode}. body=${res.body}`);
    const body = JSON.parse(res.body);
    assert.equal(body?.error, 'unauthorized');
  }

  // Missing auth => 401 (POST)
  {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/opportunities/opp-1/interactions',
      payload: { channel: 'call', notes: 'Hi' }
    });
    assert.equal(res.statusCode, 401, `expected 401, got ${res.statusCode}. body=${res.body}`);
    const body = JSON.parse(res.body);
    assert.equal(body?.error, 'unauthorized');
  }

  console.log('PASS: activity log auth guard integration tests passed');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL: activity log auth guard integration tests failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});
