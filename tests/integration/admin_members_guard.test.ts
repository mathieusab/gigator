import assert from 'node:assert/strict';

// tests/integration/admin_members_guard.test.ts
// Integration test (in-process) for admin guard on /api/admin/members
// Run with: npx tsx tests/integration/admin_members_guard.test.ts

async function importFresh<T = any>(modulePath: string): Promise<T> {
  return (await import(`${modulePath}?t=${Date.now()}-${Math.random()}`)) as any;
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
  process.env.APP_JWT_SECRET = 'test-secret';
  process.env.APP_ADMIN_EMAILS = 'admin@example.com';

  const jwtMod = await importFresh<any>('../../app/backend/lib/jwt.ts');
  const signJwt: (payload: any, secret: string) => string = jwtMod.signJwt;

  const fastify = await buildFastifyWithRoutes();

  // Case 1: Missing auth => 401
  {
    const res = await fastify.inject({ method: 'GET', url: '/api/admin/members' });
    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.equal(body?.error, 'unauthorized');
  }

  // Case 2: Authenticated but non-admin => 403
  {
    const token = signJwt(
      { sub: 'profile-123', email: 'user@example.com', full_name: 'User', avatar_url: null },
      'test-secret'
    );

    const res = await fastify.inject({
      method: 'GET',
      url: '/api/admin/members',
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(res.statusCode, 403);
    const body = JSON.parse(res.body);
    assert.equal(body?.error, 'forbidden');
  }

  await fastify.close();
  console.log('PASS: admin members guard integration test passed');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL: admin members guard integration test failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});
