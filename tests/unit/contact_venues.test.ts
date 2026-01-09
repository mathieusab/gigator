import assert from 'node:assert/strict';

// tests/unit/contact_venues.test.ts
// Unit tests for contact_venues DB helper.
// Run with: npx tsx tests/unit/contact_venues.test.ts

type Db = {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
};

async function main() {
  const mod = await import('../../app/backend/lib/contact_venues.ts');
  const linkContactToVenue: (db: Db, contactId: string, venueId: string) => Promise<void> = mod.linkContactToVenue;
  const unlinkContactFromVenue: (db: Db, contactId: string, venueId: string) => Promise<void> = mod.unlinkContactFromVenue;
  const listVenuesForContact: (db: Db, contactId: string) => Promise<any[]> = mod.listVenuesForContact;
  const listContactsForVenue: (db: Db, venueId: string) => Promise<any[]> = mod.listContactsForVenue;

  // linkContactToVenue should be idempotent (ON CONFLICT DO NOTHING)
  {
    const db: Db = {
      async query(sql, params) {
        assert.ok(/insert\s+into\s+contact_venues/i.test(sql));
        assert.ok(/on\s+conflict\s*\(\s*contact_id\s*,\s*venue_id\s*\)\s+do\s+nothing/i.test(sql.toLowerCase()));
        assert.deepEqual(params, ['c1', 'v1']);
        return { rows: [] };
      }
    };

    await linkContactToVenue(db, 'c1', 'v1');
  }

  // unlinkContactFromVenue should be idempotent (no error if missing)
  {
    const db: Db = {
      async query(sql, params) {
        assert.ok(/delete\s+from\s+contact_venues/i.test(sql));
        assert.ok(/where\s+contact_id\s*=\s*\$1/i.test(sql.toLowerCase()));
        assert.ok(/and\s+venue_id\s*=\s*\$2/i.test(sql.toLowerCase()));
        assert.deepEqual(params, ['c1', 'v1']);
        return { rows: [] };
      }
    };

    await unlinkContactFromVenue(db, 'c1', 'v1');
  }

  // listVenuesForContact joins venues
  {
    const db: Db = {
      async query(sql, params) {
        assert.ok(/from\s+venues\b/i.test(sql.toLowerCase()));
        assert.ok(/join\s+contact_venues\b/i.test(sql.toLowerCase()));
        assert.deepEqual(params, ['c1']);
        return { rows: [{ id: 'v1' }] };
      }
    };

    const rows = await listVenuesForContact(db, 'c1');
    assert.equal(rows.length, 1);
  }

  // listContactsForVenue joins contacts
  {
    const db: Db = {
      async query(sql, params) {
        assert.ok(/from\s+contacts\b/i.test(sql.toLowerCase()));
        assert.ok(/join\s+contact_venues\b/i.test(sql.toLowerCase()));
        assert.deepEqual(params, ['v1']);
        return { rows: [{ id: 'c1' }] };
      }
    };

    const rows = await listContactsForVenue(db, 'v1');
    assert.equal(rows.length, 1);
  }

  console.log('PASS: contact_venues helper unit tests passed');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL: contact_venues helper unit tests failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});
