import assert from 'node:assert/strict';

// tests/integration/search_happy_path.test.ts
// Integration test (in-process) for /api/search (stubbed pg).
// Run with: npx tsx tests/integration/search_happy_path.test.ts

async function importFresh<T = any>(modulePath: string): Promise<T> {
  return (await import(`${modulePath}?t=${Date.now()}-${Math.random()}`)) as any;
}

type ContactRow = { id: string; name: string; email: string | null; phone: string | null; instagram: string | null; notes: string | null };

type VenueRow = { id: string; name: string; city: string; notes: string | null };

type OpportunityRow = { id: string; title: string; status: string; date: string | null; venue_id: string | null; owner_id: string | null };

function setTestEnv() {
  process.env.APP_JWT_SECRET = 'test-secret';
  process.env.DATABASE_URL = 'postgres://stubbed';
}

async function stubPgConnectWithMemory() {
  const pgMod = await importFresh<any>('pg');
  const Pool = pgMod.Pool;
  const originalConnect = Pool.prototype.connect;

  const contacts: ContactRow[] = [{ id: 'c1', name: 'Alice', email: null, phone: null, instagram: null, notes: null }];
  const venues: VenueRow[] = [{ id: 'v1', name: 'Alpha Hall', city: 'Paris', notes: null }];
  const opportunities: OpportunityRow[] = [
    { id: 'o1', title: 'Alpha Booking', status: 'open', date: null, venue_id: 'v1', owner_id: null }
  ];

  Pool.prototype.connect = async function () {
    return {
      async query(sql: string, params?: any[]) {
        const q = String(sql || '').toLowerCase();
        const needle = String(params?.[0] ?? '').replace(/%/g, '').toLowerCase();

        if (q.includes('from contacts')) {
          return { rows: contacts.filter((c) => c.name.toLowerCase().includes(needle)) };
        }

        if (q.includes('from venues')) {
          return { rows: venues.filter((v) => v.name.toLowerCase().includes(needle)) };
        }

        if (q.includes('from opportunities')) {
          return { rows: opportunities.filter((o) => o.title.toLowerCase().includes(needle)) };
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

  const routesMod = await importFresh<any>('../../app/backend/routes/search.ts');
  await fastify.register(routesMod.default);

  return fastify;
}

async function main() {
  setTestEnv();
  const restorePg = await stubPgConnectWithMemory();

  try {
    const jwtMod = await importFresh<any>('../../app/backend/lib/jwt.ts');
    const signJwt: (payload: any, secret: string) => string = jwtMod.signJwt;

    const token = signJwt({ sub: 'profile-123', email: 'user@example.com' }, 'test-secret');
    const fastify = await buildFastifyWithRoutes();

    // happy path
    {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/search?q=ali',
        headers: { authorization: `Bearer ${token}` }
      });

      assert.equal(res.statusCode, 200, `expected 200, got ${res.statusCode}. body=${res.body}`);
      const body = JSON.parse(res.body);
      assert.ok(Array.isArray(body?.contacts));
      assert.ok(Array.isArray(body?.venues));
      assert.ok(Array.isArray(body?.opportunities));

      assert.equal(body.contacts.length, 1);
      assert.equal(body.contacts[0].id, 'c1');

      // ali doesn't match venue/opportunity; keep empty
      assert.equal(body.venues.length, 0);
      assert.equal(body.opportunities.length, 0);
    }

    // another query matches venue/opportunity
    {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/search?q=alpha',
        headers: { authorization: `Bearer ${token}` }
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.venues.length, 1);
      assert.equal(body.opportunities.length, 1);
    }

    // Validation: overly long q => 400
    {
      const longQ = 'x'.repeat(201);
      const res = await fastify.inject({
        method: 'GET',
        url: `/api/search?q=${longQ}`,
        headers: { authorization: `Bearer ${token}` }
      });
      assert.equal(res.statusCode, 400, `expected 400, got ${res.statusCode}. body=${res.body}`);
      const body = JSON.parse(res.body);
      assert.equal(body?.error, 'invalid_request');
    }

    await fastify.close();
  } finally {
    restorePg();
  }

  console.log('PASS: search happy-path integration test passed');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL: search happy-path integration test failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});
