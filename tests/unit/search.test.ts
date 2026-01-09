import assert from 'node:assert/strict';

// tests/unit/search.test.ts
// Unit tests for search DB helper.
// Run with: npx tsx tests/unit/search.test.ts

type Db = {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
};

async function main() {
  const mod = await import('../../app/backend/lib/search.ts');
  const searchAll: (db: Db, q: string) => Promise<any> = mod.searchAll;

  // searchAll should query contacts, venues, opportunities (limited)
  {
    const calls: Array<{ sql: string; params?: any[] }> = [];
    const db: Db = {
      async query(sql, params) {
        calls.push({ sql, params });

        if (/from\s+contacts\b/i.test(sql)) return { rows: [{ id: 'c1' }] };
        if (/from\s+venues\b/i.test(sql)) return { rows: [{ id: 'v1' }] };
        if (/from\s+opportunities\b/i.test(sql)) return { rows: [{ id: 'o1' }] };

        return { rows: [] };
      }
    };

    const res = await searchAll(db, 'Ali');
    assert.deepEqual(res.contacts, [{ id: 'c1' }]);
    assert.deepEqual(res.venues, [{ id: 'v1' }]);
    assert.deepEqual(res.opportunities, [{ id: 'o1' }]);

    // Params should be contains match
    assert.equal(calls.length, 3);
    for (const c of calls) {
      assert.ok(Array.isArray(c.params));
      assert.equal(c.params?.[0], '%ali%');
      assert.ok(/limit\s+10/i.test(c.sql));
    }
  }

  // invalid query should throw
  {
    const db: Db = { async query() { return { rows: [] }; } };
    await assert.rejects(() => searchAll(db, '   '), /invalid_request/);
  }

  console.log('PASS: search helper unit tests passed');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL: search helper unit tests failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});
