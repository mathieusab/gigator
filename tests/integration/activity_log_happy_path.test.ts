import assert from 'node:assert/strict';

// tests/integration/activity_log_happy_path.test.ts
// Integration test (in-process) for activity log routes (stubbed pg).
// Run with: npx tsx tests/integration/activity_log_happy_path.test.ts

async function importFresh<T = any>(modulePath: string): Promise<T> {
  return (await import(`${modulePath}?t=${Date.now()}-${Math.random()}`)) as any;
}

type ActivityRow = {
  id: string;
  opportunity_id: string | null;
  actor_profile_id: string | null;
  action_type: string;
  occurred_at: string;
  metadata: any;
  created_at: string;
};

type OpportunityRow = {
  id: string;
  title: string;
  description: string | null;
  next_action: string | null;
  follow_up_due_date: string | null;
  status: string;
  venue_id: string | null;
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

  const opportunities = new Map<string, OpportunityRow>();
  opportunities.set('opp-1', {
    id: 'opp-1',
    title: 'Opp',
    description: null,
    next_action: null,
    follow_up_due_date: null,
    status: 'draft',
    venue_id: null,
    created_at: now(),
    updated_at: now()
  });

  const activity = new Map<string, ActivityRow[]>();
  let seq = 1;

  Pool.prototype.connect = async function () {
    return {
      async query(sql: string, params?: any[]) {
        const q = String(sql || '').toLowerCase();

        // getOpportunityById()
        if (q.includes('from opportunities') && q.includes('where id = $1')) {
          const id = String(params?.[0] ?? '');
          const row = opportunities.get(id);
          return { rows: row ? [row] : [] };
        }

        // appendNonEmailInteraction()
        if (q.includes('insert into activity_log')) {
          const id = `evt-${seq++}`;
          const row: ActivityRow = {
            id,
            opportunity_id: String(params?.[0] ?? '') || null,
            actor_profile_id: String(params?.[1] ?? '') || null,
            action_type: String(params?.[2] ?? ''),
            occurred_at: String(params?.[3] ?? ''),
            metadata: params?.[4],
            created_at: now()
          };
          const oppId = row.opportunity_id || 'null';
          const list = activity.get(oppId) ?? [];
          list.push(row);
          activity.set(oppId, list);
          return { rows: [row] };
        }

        // listActivityForOpportunity()
        if (q.includes('from activity_log') && q.includes('where opportunity_id = $1')) {
          const oppId = String(params?.[0] ?? '') || 'null';
          const limit = Number(params?.[1] ?? 100);
          const list = (activity.get(oppId) ?? []).slice();
          list.sort((a, b) => {
            const ta = new Date(a.occurred_at).getTime();
            const tb = new Date(b.occurred_at).getTime();
            if (tb !== ta) return tb - ta;
            // id tie-breaker matches SQL ORDER BY occurred_at DESC, id DESC
            return String(b.id).localeCompare(String(a.id));
          });
          return { rows: list.slice(0, limit) };
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

  const routesMod = await importFresh<any>('../../app/backend/routes/activity_log.ts');
  const routes: (f: any) => Promise<void> = routesMod.default;
  await fastify.register(routes);

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

    // POST creates an event
    {
      const res = await fastify.inject({
        method: 'POST',
        url: '/api/opportunities/opp-1/interactions',
        headers: { authorization: `Bearer ${token}` },
        payload: { channel: 'call', notes: 'Hi', occurred_at: '2026-01-01T00:00:00.000Z' }
      });

      assert.equal(res.statusCode, 200, `expected 200, got ${res.statusCode}. body=${res.body}`);
      const body = JSON.parse(res.body);
      assert.ok(body?.id);
      assert.equal(body?.opportunity_id, 'opp-1');
      assert.equal(body?.actor_profile_id, 'profile-123');
      assert.equal(body?.action_type, 'non_email_interaction');
      assert.deepEqual(body?.metadata, { channel: 'call', notes: 'Hi' });
    }

    // GET lists the event
    {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/opportunities/opp-1/activity?limit=10',
        headers: { authorization: `Bearer ${token}` }
      });

      assert.equal(res.statusCode, 200, `expected 200, got ${res.statusCode}. body=${res.body}`);
      const body = JSON.parse(res.body);
      assert.ok(Array.isArray(body));
      assert.equal(body.length, 1);
      assert.equal(body[0]?.action_type, 'non_email_interaction');
      assert.equal(body[0]?.actor_profile_id, 'profile-123');
    }

    // Missing opportunity => 404 (GET)
    {
      const res = await fastify.inject({
        method: 'GET',
        url: '/api/opportunities/does-not-exist/activity',
        headers: { authorization: `Bearer ${token}` }
      });

      assert.equal(res.statusCode, 404, `expected 404, got ${res.statusCode}. body=${res.body}`);
      const body = JSON.parse(res.body);
      assert.equal(body?.error, 'not_found');
    }

    // Missing opportunity => 404 (POST)
    {
      const res = await fastify.inject({
        method: 'POST',
        url: '/api/opportunities/does-not-exist/interactions',
        headers: { authorization: `Bearer ${token}` },
        payload: { channel: 'call', notes: 'Hi' }
      });

      assert.equal(res.statusCode, 404, `expected 404, got ${res.statusCode}. body=${res.body}`);
      const body = JSON.parse(res.body);
      assert.equal(body?.error, 'not_found');
    }

    await fastify.close();
  } finally {
    restorePg();
  }

  console.log('PASS: activity log happy-path integration test passed');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL: activity log happy-path integration test failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});
