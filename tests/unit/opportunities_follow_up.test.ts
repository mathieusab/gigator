import assert from 'node:assert/strict';

// tests/unit/opportunities_follow_up.test.ts
// Unit tests for follow-up fields + due/overdue filtering in opportunities DB helper.
// Run with: npx tsx tests/unit/opportunities_follow_up.test.ts

type Db = {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
};

async function main() {
  const mod = await import('../../app/backend/lib/opportunities.ts');
  const updateOpportunity: (db: Db, id: string, patch: any) => Promise<any | null> = mod.updateOpportunity;
  const listOpportunities: (db: Db, filter?: any) => Promise<any[]> = mod.listOpportunities;

  // updateOpportunity supports next_action trimming (empty => null)
  {
    const db: Db = {
      async query(sql, params) {
        assert.ok(/update\s+opportunities/i.test(sql));
        assert.ok(/next_action\s*=\s*\$\d+/i.test(sql));
        assert.equal(params?.[0], null);
        assert.equal(params?.[params.length - 1], 'o1');
        return { rows: [{ id: 'o1', next_action: null }] };
      }
    };

    const row = await updateOpportunity(db, 'o1', { next_action: '   ' });
    assert.equal(row?.id, 'o1');
  }

  // updateOpportunity validates follow_up_due_date as YYYY-MM-DD
  {
    const db: Db = {
      async query() {
        throw new Error('should_not_query');
      }
    };

    let threw = false;
    try {
      await updateOpportunity(db, 'o1', { follow_up_due_date: '2026-99-99' });
    } catch (e: any) {
      threw = true;
      const msg = e instanceof Error ? e.message : String(e);
      assert.equal(msg, 'invalid_request');
    }
    assert.equal(threw, true);
  }

  // listOpportunities supports follow_up=due with injected today (UTC)
  {
    const db: Db = {
      async query(sql, params) {
        const lowered = String(sql).toLowerCase();
        assert.ok(/from\s+opportunities/i.test(lowered));
        assert.ok(/where/.test(lowered));
        assert.ok(/follow_up_due_date\s*=\s*\$1/.test(lowered));
        assert.ok(/order\s+by\s+follow_up_due_date\s+asc/.test(lowered));
        assert.ok(/updated_at\s+desc/.test(lowered));
        assert.ok(/limit\s+50/.test(lowered));
        assert.deepEqual(params, ['2026-01-09']);
        return { rows: [{ id: 'a' }] };
      }
    };

    const rows = await listOpportunities(db, { follow_up: 'due', today: '2026-01-09' });
    assert.equal(rows.length, 1);
  }

  // listOpportunities supports follow_up=overdue with injected today (UTC)
  {
    const db: Db = {
      async query(sql, params) {
        const lowered = String(sql).toLowerCase();
        assert.ok(/follow_up_due_date\s*<\s*\$1/.test(lowered));
        assert.deepEqual(params, ['2026-01-09']);
        return { rows: [] };
      }
    };

    await listOpportunities(db, { follow_up: 'overdue', today: '2026-01-09' });
  }

  console.log('PASS: opportunities follow-up unit tests passed');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL: opportunities follow-up unit tests failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});
