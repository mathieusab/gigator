import assert from 'node:assert/strict';

// tests/integration/venues_happy_path.test.ts
// Integration test (in-process) for /api/venues CRUD-ish behavior (stubbed pg).
// Run with: npx tsx tests/integration/venues_happy_path.test.ts

async function importFresh<T = any>(modulePath: string): Promise<T> {
  return (await import(`${modulePath}?t=${Date.now()}-${Math.random()}`)) as any;
}

type VenueRow = {
  id: string;
  name: string;
  city: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function setTestEnv() {
  process.env.APP_JWT_SECRET = 'test-secret';
  process.env.DATABASE_URL = 'postgres://stubbed';
}

async function stubPgConnectWithMemory() {
  const pgMod = await importFresh<any>('pg');
  const Pool = pgMod.Pool;
  const originalConnect = Pool.prototype.connect;

  const now = () => new Date().toISOString();
  const venues = new Map<string, VenueRow>();
  let seq = 1;

  Pool.prototype.connect = async function () {
    return {
      async query(sql: string, params?: any[]) {
        const q = String(sql || '').toLowerCase();

        if (q.includes('insert into venues')) {
          const id = `v-${seq++}`;
          const row: VenueRow = {
            id,
            name: String(params?.[0] ?? ''),
            city: String(params?.[1] ?? ''),
            notes: (params?.[2] ?? null) as any,
            created_at: now(),
            updated_at: now()
          };
          venues.set(id, row);
          return { rows: [row] };
        }

        if (q.includes('from venues') && q.includes('order by lower(name)')) {
          const rows = Array.from(venues.values()).sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
          return { rows };
        }

        if (q.includes('from venues') && q.includes('where id = $1')) {
          const id = String(params?.[0] ?? '');
          const row = venues.get(id);
          return { rows: row ? [row] : [] };
        }

        if (q.includes('update venues')) {
          const id = String(params?.[params.length - 1] ?? '');
          const row = venues.get(id);
          if (!row) return { rows: [] };

          // Apply updates based on SET clause ordering. Our helper always appends updated_at.
          // We infer which fields are being set by scanning the SQL.
          const setClause = q.split('set')[1]?.split('where')[0] ?? '';
          let p = 0;

          if (setClause.includes('name = $')) {
            row.name = String(params?.[p++] ?? row.name);
          }
          if (setClause.includes('city = $')) {
            row.city = String(params?.[p++] ?? row.city);
          }
          if (setClause.includes('notes = $')) {
            row.notes = (params?.[p++] ?? null) as any;
          }

          row.updated_at = now();
          venues.set(id, row);
          return { rows: [row] };
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

  const routesMod = await importFresh<any>('../../app/backend/routes/venues.ts');
  const venuesRoutes: (f: any) => Promise<void> = routesMod.default;
  await fastify.register(venuesRoutes);

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

    // POST create
    let createdId: string;
    {
      const res = await fastify.inject({
        method: 'POST',
        url: '/api/venues',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Zeta', city: 'Paris', notes: 'note' }
      });

      assert.equal(res.statusCode, 200, `expected 200, got ${res.statusCode}. body=${res.body}`);
      const body = JSON.parse(res.body);
      assert.ok(body?.id);
      assert.equal(body?.name, 'Zeta');
      assert.equal(body?.city, 'Paris');
      createdId = body.id;
    }

    // GET list
    {
      // create another to validate ordering
      await fastify.inject({
        method: 'POST',
        url: '/api/venues',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Alpha', city: 'Lyon' }
      });

      const res = await fastify.inject({
        method: 'GET',
        url: '/api/venues',
        headers: { authorization: `Bearer ${token}` }
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(Array.isArray(body));
      assert.equal(body.length >= 2, true);
      assert.equal(body[0].name.toLowerCase(), 'alpha');
      assert.equal(body[body.length - 1].name.toLowerCase(), 'zeta');
    }

    // GET detail
    {
      const res = await fastify.inject({
        method: 'GET',
        url: `/api/venues/${createdId}`,
        headers: { authorization: `Bearer ${token}` }
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body?.id, createdId);
      assert.equal(body?.name, 'Zeta');
    }

    // PATCH update
    {
      const res = await fastify.inject({
        method: 'PATCH',
        url: `/api/venues/${createdId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { notes: null }
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body?.id, createdId);
      assert.equal(body?.notes, null);
    }

    await fastify.close();
  } finally {
    restorePg();
  }

  console.log('PASS: venues happy-path integration test passed');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL: venues happy-path integration test failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});
