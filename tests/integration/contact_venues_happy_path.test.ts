import assert from 'node:assert/strict';

// tests/integration/contact_venues_happy_path.test.ts
// Integration test (in-process) for linking contacts ↔ venues (stubbed pg).
// Run with: npx tsx tests/integration/contact_venues_happy_path.test.ts

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

  const venues = new Map<string, VenueRow>();
  const contacts = new Map<string, ContactRow>();
  const links = new Set<string>(); // `${contactId}|${venueId}`

  let venueSeq = 1;
  let contactSeq = 1;

  function linkKey(contactId: string, venueId: string) {
    return `${contactId}|${venueId}`;
  }

  Pool.prototype.connect = async function () {
    return {
      async query(sql: string, params?: any[]) {
        const q = String(sql || '').toLowerCase();

        // venues
        if (q.includes('insert into venues')) {
          const id = `v-${venueSeq++}`;
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

        // contacts
        if (q.includes('insert into contacts')) {
          const id = `c-${contactSeq++}`;
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

        // link insert
        if (q.includes('insert into contact_venues')) {
          const contactId = String(params?.[0] ?? '');
          const venueId = String(params?.[1] ?? '');

          if (!contacts.has(contactId) || !venues.has(venueId)) {
            const err: any = new Error('fk_violation');
            err.code = '23503';
            throw err;
          }

          links.add(linkKey(contactId, venueId));
          return { rows: [] };
        }

        // unlink
        if (q.includes('delete from contact_venues')) {
          const contactId = String(params?.[0] ?? '');
          const venueId = String(params?.[1] ?? '');
          links.delete(linkKey(contactId, venueId));
          return { rows: [] };
        }

        // list venues for contact
        if (q.includes('from venues') && q.includes('join contact_venues') && q.includes('where cv.contact_id = $1')) {
          const contactId = String(params?.[0] ?? '');
          const venueIds = Array.from(links)
            .filter((k) => k.startsWith(`${contactId}|`))
            .map((k) => k.split('|')[1]);

          const rows = venueIds
            .map((id) => venues.get(id))
            .filter(Boolean)
            .sort((a, b) => (a!.name.toLowerCase().localeCompare(b!.name.toLowerCase())));

          return { rows };
        }

        // list contacts for venue
        if (q.includes('from contacts') && q.includes('join contact_venues') && q.includes('where cv.venue_id = $1')) {
          const venueId = String(params?.[0] ?? '');
          const contactIds = Array.from(links)
            .filter((k) => k.endsWith(`|${venueId}`))
            .map((k) => k.split('|')[0]);

          const rows = contactIds
            .map((id) => contacts.get(id))
            .filter(Boolean)
            .sort((a, b) => (a!.name.toLowerCase().localeCompare(b!.name.toLowerCase())));

          return { rows };
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

  const venuesMod = await importFresh<any>('../../app/backend/routes/venues.ts');
  const contactsMod = await importFresh<any>('../../app/backend/routes/contacts.ts');
  const linksMod = await importFresh<any>('../../app/backend/routes/contact_venues.ts');

  await fastify.register(venuesMod.default);
  await fastify.register(contactsMod.default);
  await fastify.register(linksMod.default);

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

    // Create a venue
    let venueId: string;
    {
      const res = await fastify.inject({
        method: 'POST',
        url: '/api/venues',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Zeta Hall', city: 'Paris' }
      });
      assert.equal(res.statusCode, 200, `expected 200, got ${res.statusCode}. body=${res.body}`);
      const body = JSON.parse(res.body);
      venueId = body.id;
    }

    // Create a contact
    let contactId: string;
    {
      const res = await fastify.inject({
        method: 'POST',
        url: '/api/contacts',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Alice' }
      });
      assert.equal(res.statusCode, 200, `expected 200, got ${res.statusCode}. body=${res.body}`);
      const body = JSON.parse(res.body);
      contactId = body.id;
    }

    // Link
    {
      const res = await fastify.inject({
        method: 'POST',
        url: `/api/contacts/${contactId}/venues`,
        headers: { authorization: `Bearer ${token}` },
        payload: { venue_id: venueId }
      });
      assert.equal(res.statusCode, 200, `expected 200, got ${res.statusCode}. body=${res.body}`);
    }

    // Visible côté contact
    {
      const res = await fastify.inject({
        method: 'GET',
        url: `/api/contacts/${contactId}/venues`,
        headers: { authorization: `Bearer ${token}` }
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(Array.isArray(body));
      assert.equal(body.length, 1);
      assert.equal(body[0].id, venueId);
    }

    // Visible côté venue
    {
      const res = await fastify.inject({
        method: 'GET',
        url: `/api/venues/${venueId}/contacts`,
        headers: { authorization: `Bearer ${token}` }
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(Array.isArray(body));
      assert.equal(body.length, 1);
      assert.equal(body[0].id, contactId);
    }

    // FK violation => 404 not_found
    {
      const res = await fastify.inject({
        method: 'POST',
        url: `/api/contacts/${contactId}/venues`,
        headers: { authorization: `Bearer ${token}` },
        payload: { venue_id: 'does-not-exist' }
      });
      assert.equal(res.statusCode, 404, `expected 404, got ${res.statusCode}. body=${res.body}`);
      const body = JSON.parse(res.body);
      assert.equal(body?.error, 'not_found');
    }

    await fastify.close();
  } finally {
    restorePg();
  }

  console.log('PASS: contact_venues happy-path integration test passed');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL: contact_venues happy-path integration test failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});
