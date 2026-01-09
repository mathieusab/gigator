import assert from 'node:assert/strict';

// tests/unit/activity_log.test.ts
// Unit tests for activity log DB helpers.
// Run with: npx tsx tests/unit/activity_log.test.ts

type Db = {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
};

async function main() {
  const mod = await import('../../app/backend/lib/activity_log.ts');
  const appendNonEmailInteraction: (db: Db, input: any) => Promise<any> = mod.appendNonEmailInteraction;
  const listActivityForOpportunity: (db: Db, opportunityId: string, input?: any) => Promise<any[]> = mod.listActivityForOpportunity;

  // appendNonEmailInteraction inserts a non_email_interaction with metadata
  {
    const db: Db = {
      async query(sql, params) {
        assert.ok(/insert\s+into\s+activity_log/i.test(sql));
        assert.ok(/returning/i.test(sql));
        assert.ok(Array.isArray(params));
        assert.deepEqual(params?.slice(0, 3), ['opp-1', 'profile-1', 'non_email_interaction']);
        assert.equal(typeof params?.[3], 'string');
        assert.ok(String(params?.[3]).includes('T'));
        assert.deepEqual(params?.[4], { channel: 'call', notes: 'Hello' });
        return {
          rows: [
            {
              id: 'evt-1',
              opportunity_id: 'opp-1',
              actor_profile_id: 'profile-1',
              action_type: 'non_email_interaction',
              occurred_at: params?.[3],
              metadata: params?.[4],
              created_at: '2026-01-01T00:00:00.000Z'
            }
          ]
        };
      }
    };

    const row = await appendNonEmailInteraction(db, {
      opportunity_id: 'opp-1',
      actor_profile_id: 'profile-1',
      channel: 'call',
      notes: ' Hello '
    });
    assert.equal(row.id, 'evt-1');
    assert.equal(row.action_type, 'non_email_interaction');
    assert.deepEqual(row.metadata, { channel: 'call', notes: 'Hello' });
  }

  // appendNonEmailInteraction rejects invalid channel
  {
    const db: Db = {
      async query() {
        throw new Error('should_not_query');
      }
    };

    let threw = false;
    try {
      await appendNonEmailInteraction(db, {
        opportunity_id: 'opp-1',
        actor_profile_id: 'profile-1',
        channel: 'sms'
      });
    } catch (e: any) {
      threw = true;
      const msg = e instanceof Error ? e.message : String(e);
      assert.equal(msg, 'invalid_request');
    }
    assert.equal(threw, true);
  }

  // listActivityForOpportunity orders by occurred_at desc and enforces limit param
  {
    const db: Db = {
      async query(sql, params) {
        assert.ok(/from\s+activity_log/i.test(sql));
        assert.ok(/order\s+by\s+occurred_at\s+desc/i.test(sql.toLowerCase()));
        assert.deepEqual(params, ['opp-1', 50]);
        return { rows: [{ id: 'a' }, { id: 'b' }] };
      }
    };

    const rows = await listActivityForOpportunity(db, 'opp-1', { limit: 50 });
    assert.equal(rows.length, 2);
  }

  // listActivityForOpportunity rejects too-large limit
  {
    const db: Db = {
      async query() {
        throw new Error('should_not_query');
      }
    };

    let threw = false;
    try {
      await listActivityForOpportunity(db, 'opp-1', { limit: 999 });
    } catch (e: any) {
      threw = true;
      const msg = e instanceof Error ? e.message : String(e);
      assert.equal(msg, 'invalid_request');
    }
    assert.equal(threw, true);
  }

  console.log('PASS: activity_log helper unit tests passed');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL: activity_log helper unit tests failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});
