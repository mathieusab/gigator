import assert from 'node:assert/strict';

// tests/integration/opportunities_follow_up_happy_path.test.ts
// In-process integration-ish test for opportunities follow_up filter + derived follow_up_status.
// Run with: npx tsx tests/integration/opportunities_follow_up_happy_path.test.ts

async function importFresh<T = any>(modulePath: string): Promise<T> {
  return (await import(`${modulePath}?t=${Date.now()}-${Math.random()}`)) as any;
}

async function buildFastifyWithRoutes(dbClient: any) {
  const fastifyModule = await importFresh<any>('fastify');
  const fastify = fastifyModule.default({ logger: false });

  // Inject a fake dbPool so routes don't touch real Postgres.
  fastify.decorate('dbPool', {
    async connect() {
      return dbClient;
    }
  });

  const routesMod = await importFresh<any>('../../app/backend/routes/opportunities.ts');
  const opportunitiesRoutes: (f: any) => Promise<void> = routesMod.default;
  await fastify.register(opportunitiesRoutes);

  return fastify;
}

async function main() {
  process.env.APP_JWT_SECRET = 'test-secret';

  const jwtMod = await importFresh<any>('../../app/backend/lib/jwt.ts');
  const signJwt: (payload: any, secret: string) => string = jwtMod.signJwt;
  const token = signJwt({ sub: 'profile-123', email: 'user@example.com' }, 'test-secret');

  let mode: 'due' | 'overdue' | 'unfiltered' = 'unfiltered';

  const dbClient = {
    async query(sql: string, params?: any[]) {
      const lowered = String(sql).toLowerCase();
      assert.ok(/from\s+opportunities/i.test(lowered));
      assert.ok(/order\s+by/i.test(lowered));

      if (mode === 'due') {
        assert.ok(/follow_up_due_date\s*=\s*\$1/.test(lowered));
        assert.ok(/order\s+by\s+follow_up_due_date\s+asc/.test(lowered));
        assert.ok(/limit\s+50/.test(lowered));
        assert.ok(Array.isArray(params) && typeof params[0] === 'string');
        const today = params![0];
        return {
          rows: [
            {
              id: 'o1',
              title: 'T',
              description: null,
              next_action: null,
              follow_up_due_date: today,
              venue_id: null,
              status: 'open',
              created_at: 'x',
              updated_at: 'y'
            }
          ]
        };
      }

      if (mode === 'overdue') {
        assert.ok(/follow_up_due_date\s*<\s*\$1/.test(lowered));
        assert.ok(/order\s+by\s+follow_up_due_date\s+asc/.test(lowered));
        assert.ok(/limit\s+50/.test(lowered));
        assert.ok(Array.isArray(params) && typeof params[0] === 'string');
        return {
          rows: [
            {
              id: 'o2',
              title: 'T2',
              description: null,
              next_action: null,
              follow_up_due_date: '0001-01-01',
              venue_id: null,
              status: 'open',
              created_at: 'x',
              updated_at: 'y'
            }
          ]
        };
      }

      // unfiltered list should still be bounded
      assert.ok(/limit\s+200/.test(lowered));
      assert.deepEqual(params, []);
      return { rows: [] };
    },
    release() {
      // no-op
    }
  };

  const fastify = await buildFastifyWithRoutes(dbClient);

  // Unfiltered list is bounded
  {
    mode = 'unfiltered';
    const res = await fastify.inject({
      method: 'GET',
      url: '/api/opportunities',
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(res.statusCode, 200, `expected 200, got ${res.statusCode}. body=${res.body}`);
  }

  // follow_up=due returns derived follow_up_status=due
  {
    mode = 'due';
    const res = await fastify.inject({
      method: 'GET',
      url: '/api/opportunities?follow_up=due',
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(res.statusCode, 200, `expected 200, got ${res.statusCode}. body=${res.body}`);
    const body = JSON.parse(res.body);
    assert.equal(Array.isArray(body), true);
    assert.equal(body[0]?.follow_up_status, 'due');
  }

  // follow_up=overdue returns derived follow_up_status=overdue
  {
    mode = 'overdue';
    const res = await fastify.inject({
      method: 'GET',
      url: '/api/opportunities?follow_up=overdue',
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(res.statusCode, 200, `expected 200, got ${res.statusCode}. body=${res.body}`);
    const body = JSON.parse(res.body);
    assert.equal(Array.isArray(body), true);
    assert.equal(body[0]?.follow_up_status, 'overdue');
  }

  await fastify.close();
  console.log('PASS: opportunities follow-up happy path integration test passed');
  process.exit(0);
}

main().catch(async (err) => {
  console.error('FAIL: opportunities follow-up happy path integration test failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});
