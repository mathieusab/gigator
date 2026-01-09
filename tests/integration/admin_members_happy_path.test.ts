import assert from 'node:assert/strict';

// tests/integration/admin_members_happy_path.test.ts
// Integration test (in-process) for /api/admin/members CRUD-ish behavior
// Run with: npx tsx tests/integration/admin_members_happy_path.test.ts

async function importFresh<T = any>(modulePath: string): Promise<T> {
  return (await import(`${modulePath}?t=${Date.now()}-${Math.random()}`)) as any;
}

type MemberRow = {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function setTestEnv() {
  process.env.APP_JWT_SECRET = 'test-secret';
  process.env.APP_ADMIN_EMAILS = 'admin@example.com';
  process.env.DATABASE_URL = 'postgres://user:pass@127.0.0.1:5432/db';
}

async function stubPgConnectWithMemory() {
  const pgMod = await importFresh<any>('pg');
  const Pool = pgMod.Pool;
  const originalConnect = Pool.prototype.connect;

  const now = () => new Date().toISOString();

  const membersById = new Map<string, MemberRow>();

  // Seed with one inactive entry that should be listable
  membersById.set('id-1', {
    id: 'id-1',
    email: 'z@example.com',
    is_active: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  });

  Pool.prototype.connect = async function () {
    return {
      async query(sql: string, params?: any[]) {
        const s = String(sql);

        // listMembers
        if (s.includes('FROM app_email_allowlist') && s.includes('ORDER BY lower(email)')) {
          const rows = Array.from(membersById.values()).sort((a, b) => a.email.toLowerCase().localeCompare(b.email.toLowerCase()));
          return { rows };
        }

        // upsertInvite: update existing case-insensitive OR insert
        if (s.includes('UPDATE app_email_allowlist') && s.includes('WHERE lower(email) = lower($1)')) {
          const email = String(params?.[0] ?? '');
          const existing = Array.from(membersById.values()).find((m) => m.email.toLowerCase() === email.toLowerCase());
          if (!existing) return { rows: [] };
          const updated: MemberRow = { ...existing, is_active: true, updated_at: now() };
          membersById.set(updated.id, updated);
          return { rows: [updated] };
        }

        if (s.includes('INSERT INTO app_email_allowlist') && s.includes('RETURNING id, email, is_active')) {
          const email = String(params?.[0] ?? '');
          const existing = Array.from(membersById.values()).find((m) => m.email.toLowerCase() === email.toLowerCase());
          if (existing) {
            const updated: MemberRow = { ...existing, is_active: true, updated_at: now() };
            membersById.set(updated.id, updated);
            return { rows: [updated] };
          }

          const created: MemberRow = {
            id: `id-${membersById.size + 1}`,
            email,
            is_active: true,
            created_at: now(),
            updated_at: now()
          };
          membersById.set(created.id, created);
          return { rows: [created] };
        }

        // setMemberActive (idempotent)
        if (s.includes('UPDATE app_email_allowlist') && s.includes('WHERE id = $2')) {
          const isActive = !!params?.[0];
          const id = String(params?.[1] ?? '');
          const existing = membersById.get(id);
          if (!existing) return { rows: [] };

          if (existing.is_active === isActive) {
            return { rows: [existing] };
          }

          const updated: MemberRow = { ...existing, is_active: isActive, updated_at: now() };
          membersById.set(updated.id, updated);
          return { rows: [updated] };
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

  const routesMod = await importFresh<any>('../../app/backend/routes/admin_members.ts');
  const adminMembersRoutes: (f: any) => Promise<void> = routesMod.default;
  await fastify.register(adminMembersRoutes);

  return fastify;
}

async function main() {
  setTestEnv();
  const restorePg = await stubPgConnectWithMemory();

  try {
    const jwtMod = await importFresh<any>('../../app/backend/lib/jwt.ts');
    const signJwt: (payload: any, secret: string) => string = jwtMod.signJwt;

    const token = signJwt(
      { sub: 'profile-admin', email: 'admin@example.com', full_name: 'Admin', avatar_url: null },
      'test-secret'
    );

    const fastify = await buildFastifyWithRoutes();

    // GET list
    {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/admin/members',
        headers: { authorization: `Bearer ${token}` }
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(Array.isArray(body));
      assert.ok(body.length >= 1);
      assert.equal(body[0].email.toLowerCase() <= body[body.length - 1].email.toLowerCase(), true);
    }

    // POST invite (creates/reactivates)
    let createdId = '';
    {
      const res = await fastify.inject({
        method: 'POST',
        url: '/api/admin/members',
        headers: { authorization: `Bearer ${token}` },
        payload: { email: 'NewUser@Example.com' }
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.email, 'newuser@example.com');
      assert.equal(body.is_active, true);
      createdId = body.id;
    }

    // PATCH toggle inactive
    {
      const res = await fastify.inject({
        method: 'PATCH',
        url: `/api/admin/members/${createdId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { is_active: false }
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.id, createdId);
      assert.equal(body.is_active, false);
    }

    // PATCH non-existent => 404
    {
      const res = await fastify.inject({
        method: 'PATCH',
        url: '/api/admin/members/does-not-exist',
        headers: { authorization: `Bearer ${token}` },
        payload: { is_active: true }
      });
      assert.equal(res.statusCode, 404);
      const body = JSON.parse(res.body);
      assert.equal(body?.error, 'not_found');
    }

    await fastify.close();

    console.log('PASS: admin members happy-path integration test passed');
    process.exit(0);
  } finally {
    restorePg();
  }
}

main().catch((err) => {
  console.error('FAIL: admin members happy-path integration test failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});
