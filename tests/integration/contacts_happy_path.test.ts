import assert from 'node:assert/strict';

// tests/integration/contacts_happy_path.test.ts
// Integration test (in-process) for /api/contacts CRUD-ish behavior (stubbed pg).
// Run with: npx tsx tests/integration/contacts_happy_path.test.ts

async function importFresh<T = any>(modulePath: string): Promise<T> {
  return (await import(`${modulePath}?t=${Date.now()}-${Math.random()}`)) as any;
}

type ContactRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  instagram: string | null;
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
  const contacts = new Map<string, ContactRow>();
  let seq = 1;

  Pool.prototype.connect = async function () {
    return {
      async query(sql: string, params?: any[]) {
        const q = String(sql || '').toLowerCase();

        if (q.includes('insert into contacts')) {
          const id = `c-${seq++}`;
          const row: ContactRow = {
            id,
            name: String(params?.[0] ?? ''),
            email: (params?.[1] ?? null) as any,
            phone: (params?.[2] ?? null) as any,
            instagram: (params?.[3] ?? null) as any,
            notes: (params?.[4] ?? null) as any,
            created_at: now(),
            updated_at: now()
          };
          contacts.set(id, row);
          return { rows: [row] };
        }

        if (q.includes('from contacts') && q.includes('where id = $1')) {
          const id = String(params?.[0] ?? '');
          const row = contacts.get(id);
          return { rows: row ? [row] : [] };
        }

        if (q.includes('from contacts') && q.includes('order by lower(name)')) {
          let rows = Array.from(contacts.values());

          if (q.includes('where lower(name) like $1')) {
            const needle = String(params?.[0] ?? '');
            const n = needle.replace(/%/g, '').toLowerCase();
            rows = rows.filter((c) => c.name.toLowerCase().includes(n));
          }

          rows.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
          return { rows };
        }

        if (q.includes('update contacts')) {
          const id = String(params?.[params.length - 1] ?? '');
          const row = contacts.get(id);
          if (!row) return { rows: [] };

          const setClause = q.split('set')[1]?.split('where')[0] ?? '';
          let p = 0;

          if (setClause.includes('name = $')) row.name = String(params?.[p++] ?? row.name);
          if (setClause.includes('email = $')) row.email = (params?.[p++] ?? null) as any;
          if (setClause.includes('phone = $')) row.phone = (params?.[p++] ?? null) as any;
          if (setClause.includes('instagram = $')) row.instagram = (params?.[p++] ?? null) as any;
          if (setClause.includes('notes = $')) row.notes = (params?.[p++] ?? null) as any;

          row.updated_at = now();
          contacts.set(id, row);
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

  const routesMod = await importFresh<any>('../../app/backend/routes/contacts.ts');
  const contactsRoutes: (f: any) => Promise<void> = routesMod.default;
  await fastify.register(contactsRoutes);

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
        url: '/api/contacts',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Alice', email: 'a@example.com', notes: 'note' }
      });

      assert.equal(res.statusCode, 200, `expected 200, got ${res.statusCode}. body=${res.body}`);
      const body = JSON.parse(res.body);
      assert.ok(body?.id);
      assert.equal(body?.name, 'Alice');
      createdId = body.id;
    }

    // GET list (ordering)
    {
      await fastify.inject({
        method: 'POST',
        url: '/api/contacts',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Bob' }
      });

      const res = await fastify.inject({
        method: 'GET',
        url: '/api/contacts',
        headers: { authorization: `Bearer ${token}` }
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(Array.isArray(body));
      assert.equal(body.length >= 2, true);
      assert.equal(body[0].name.toLowerCase(), 'alice');
      assert.equal(body[body.length - 1].name.toLowerCase(), 'bob');
    }

    // GET list with q filter
    {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/contacts?q=ali',
        headers: { authorization: `Bearer ${token}` }
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(Array.isArray(body));
      assert.equal(body.length, 1);
      assert.equal(body[0].name, 'Alice');
    }

    // GET detail
    {
      const res = await fastify.inject({
        method: 'GET',
        url: `/api/contacts/${createdId}`,
        headers: { authorization: `Bearer ${token}` }
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body?.id, createdId);
      assert.equal(body?.name, 'Alice');
    }

    // PATCH update
    {
      const res = await fastify.inject({
        method: 'PATCH',
        url: `/api/contacts/${createdId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { notes: null }
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body?.id, createdId);
      assert.equal(body?.notes, null);
    }

    // Validation: overly long q => 400
    {
      const longQ = 'x'.repeat(201);
      const res = await fastify.inject({
        method: 'GET',
        url: `/api/contacts?q=${longQ}`,
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

  console.log('PASS: contacts happy-path integration test passed');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL: contacts happy-path integration test failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});
