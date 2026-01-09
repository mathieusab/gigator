import assert from 'node:assert/strict';

// tests/unit/opportunities.test.ts
// Unit tests for opportunities DB helper.
// Run with: npx tsx tests/unit/opportunities.test.ts

type Db = {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
};

async function main() {
  const mod = await import('../../app/backend/lib/opportunities.ts');
  const createOpportunity: (db: Db, input: any) => Promise<any> = mod.createOpportunity;
  const listOpportunities: (db: Db, filter?: any) => Promise<any[]> = mod.listOpportunities;
  const getOpportunityById: (db: Db, id: string) => Promise<any | null> = mod.getOpportunityById;
  const updateOpportunity: (db: Db, id: string, patch: any) => Promise<any | null> = mod.updateOpportunity;

  // createOpportunity trims and inserts with optional fields
  {
    const db: Db = {
      async query(sql, params) {
        assert.ok(/insert\s+into\s+opportunities/i.test(sql));
        assert.ok(/returning/i.test(sql));
        assert.deepEqual(params, ['My Opp', 'notes', 'venue-1']);
        return { rows: [{ id: 'o1', title: 'My Opp', description: 'notes', venue_id: 'venue-1', status: 'draft' }] };
      }
    };

    const row = await createOpportunity(db, { title: '  My Opp  ', description: ' notes ', venue_id: 'venue-1' });
    assert.equal(row.id, 'o1');
    assert.equal(row.title, 'My Opp');
    assert.equal(row.description, 'notes');
    assert.equal(row.venue_id, 'venue-1');
  }

  // listOpportunities orders by updated_at desc (stable)
  {
    const db: Db = {
      async query(sql, params) {
        assert.ok(/from\s+opportunities/i.test(sql));
        assert.ok(/order\s+by\s+updated_at\s+desc/i.test(sql.toLowerCase()));
        assert.deepEqual(params, []);
        return { rows: [{ id: 'a' }, { id: 'b' }] };
      }
    };

    const rows = await listOpportunities(db);
    assert.equal(rows.length, 2);
  }

  // listOpportunities can filter by venue_id
  {
    const db: Db = {
      async query(sql, params) {
        assert.ok(/where\s+venue_id\s*=\s*\$1/i.test(sql.toLowerCase()));
        assert.deepEqual(params, ['v1']);
        return { rows: [] };
      }
    };

    await listOpportunities(db, { venue_id: 'v1' });
  }

  // getOpportunityById uses param
  {
    const db: Db = {
      async query(sql, params) {
        assert.ok(/where\s+id\s*=\s*\$1/i.test(sql.toLowerCase()));
        assert.deepEqual(params, ['o1']);
        return { rows: [{ id: 'o1', title: 'X', status: 'open', description: null, venue_id: null }] };
      }
    };

    const row = await getOpportunityById(db, 'o1');
    assert.equal(row?.id, 'o1');
  }

  // updateOpportunity validates at least one field and returns row; null if not found
  {
    const db: Db = {
      async query(sql, params) {
        assert.ok(/update\s+opportunities/i.test(sql));
        assert.ok(/set/i.test(sql));
        assert.ok(/where\s+id\s*=\s*\$\d+/i.test(sql.toLowerCase()));
        assert.ok(Array.isArray(params));
        assert.equal(params?.[params.length - 1], 'o1');
        return { rows: [{ id: 'o1', title: 'T', status: 'booked', description: 'd', venue_id: null }] };
      }
    };

    const row = await updateOpportunity(db, 'o1', { status: 'booked', description: ' d ' });
    assert.equal(row?.id, 'o1');
  }

  // updateOpportunity rejects unknown status
  {
    const db: Db = {
      async query() {
        throw new Error('should_not_query');
      }
    };

    let threw = false;
    try {
      await updateOpportunity(db, 'o1', { status: 'nope' });
    } catch (e: any) {
      threw = true;
      const msg = e instanceof Error ? e.message : String(e);
      assert.equal(msg, 'invalid_request');
    }
    assert.equal(threw, true);
  }

  {
    const db: Db = {
      async query() {
        return { rows: [] };
      }
    };

    const row = await updateOpportunity(db, 'missing', { title: 'T' });
    assert.equal(row, null);
  }

  console.log('PASS: opportunities helper unit tests passed');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL: opportunities helper unit tests failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});
