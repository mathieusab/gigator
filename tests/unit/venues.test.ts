import assert from 'node:assert/strict';

// tests/unit/venues.test.ts
// Unit tests for venues DB helper.
// Run with: npx tsx tests/unit/venues.test.ts

type Db = {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
};

async function main() {
  const mod = await import('../../app/backend/lib/venues.ts');
  const createVenue: (db: Db, input: any) => Promise<any> = mod.createVenue;
  const listVenues: (db: Db) => Promise<any[]> = mod.listVenues;
  const getVenueById: (db: Db, id: string) => Promise<any | null> = mod.getVenueById;
  const updateVenue: (db: Db, id: string, patch: any) => Promise<any | null> = mod.updateVenue;

  // createVenue trims and inserts
  {
    const db: Db = {
      async query(sql, params) {
        assert.ok(/insert\s+into\s+venues/i.test(sql));
        assert.ok(/returning/i.test(sql));
        assert.deepEqual(params, ['My Venue', 'Paris', 'note']);
        return { rows: [{ id: 'v1', name: 'My Venue', city: 'Paris', notes: 'note' }] };
      }
    };

    const row = await createVenue(db, { name: '  My Venue  ', city: '  Paris ', notes: ' note ' });
    assert.equal(row.id, 'v1');
    assert.equal(row.name, 'My Venue');
    assert.equal(row.city, 'Paris');
    assert.equal(row.notes, 'note');
  }

  // listVenues orders by lower(name)
  {
    const db: Db = {
      async query(sql) {
        assert.ok(/from\s+venues/i.test(sql));
        assert.ok(/order\s+by\s+lower\(name\)\s+asc/i.test(sql.toLowerCase()));
        return { rows: [{ id: 'a' }, { id: 'b' }] };
      }
    };

    const rows = await listVenues(db);
    assert.equal(rows.length, 2);
  }

  // getVenueById uses param
  {
    const db: Db = {
      async query(sql, params) {
        assert.ok(/where\s+id\s*=\s*\$1/i.test(sql.toLowerCase()));
        assert.deepEqual(params, ['v1']);
        return { rows: [{ id: 'v1', name: 'X', city: 'Y', notes: null }] };
      }
    };

    const row = await getVenueById(db, 'v1');
    assert.equal(row?.id, 'v1');
  }

  // updateVenue builds update and returns row; null if not found
  {
    const db: Db = {
      async query(sql, params) {
        assert.ok(/update\s+venues/i.test(sql));
        assert.ok(/set/i.test(sql));
        assert.ok(/where\s+id\s*=\s*\$\d+/i.test(sql.toLowerCase()));
        assert.ok(Array.isArray(params));
        // last param should be id
        assert.equal(params?.[params.length - 1], 'v1');
        return { rows: [{ id: 'v1', name: 'N', city: 'C', notes: null }] };
      }
    };

    const row = await updateVenue(db, 'v1', { name: ' N ', notes: null });
    assert.equal(row?.id, 'v1');
  }

  {
    const db: Db = {
      async query() {
        return { rows: [] };
      }
    };

    const row = await updateVenue(db, 'missing', { name: 'N' });
    assert.equal(row, null);
  }

  console.log('PASS: venues helper unit tests passed');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL: venues helper unit tests failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});
