import assert from 'node:assert/strict';

// tests/unit/contacts.test.ts
// Unit tests for contacts DB helper.
// Run with: npx tsx tests/unit/contacts.test.ts

type Db = {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
};

async function main() {
  const mod = await import('../../app/backend/lib/contacts.ts');
  const createContact: (db: Db, input: any) => Promise<any> = mod.createContact;
  const listContacts: (db: Db, input?: any) => Promise<any[]> = mod.listContacts;
  const getContactById: (db: Db, id: string) => Promise<any | null> = mod.getContactById;
  const updateContact: (db: Db, id: string, patch: any) => Promise<any | null> = mod.updateContact;

  // createContact trims and inserts
  {
    const db: Db = {
      async query(sql, params) {
        assert.ok(/insert\s+into\s+contacts/i.test(sql));
        assert.ok(/returning/i.test(sql));
        assert.deepEqual(params, ['Alice', 'a@example.com', '+33 1', '@alice', 'note']);
        return {
          rows: [{ id: 'c1', name: 'Alice', email: 'a@example.com', phone: '+33 1', instagram: '@alice', notes: 'note' }]
        };
      }
    };

    const row = await createContact(db, {
      name: '  Alice  ',
      email: ' a@example.com ',
      phone: ' +33 1 ',
      instagram: ' @alice ',
      notes: ' note '
    });

    assert.equal(row.id, 'c1');
    assert.equal(row.name, 'Alice');
    assert.equal(row.email, 'a@example.com');
    assert.equal(row.phone, '+33 1');
    assert.equal(row.instagram, '@alice');
    assert.equal(row.notes, 'note');
  }

  // listContacts supports q filtering
  {
    const db: Db = {
      async query(sql, params) {
        assert.ok(/from\s+contacts/i.test(sql));
        assert.ok(/order\s+by\s+lower\(name\)\s+asc/i.test(sql.toLowerCase()));
        assert.ok(/where\s+lower\(name\)\s+like\s+\$1/i.test(sql.toLowerCase()));
        assert.deepEqual(params, ['%ali%']);
        return { rows: [{ id: 'c1' }] };
      }
    };

    const rows = await listContacts(db, { q: ' ali ' });
    assert.equal(rows.length, 1);
  }

  // getContactById uses param
  {
    const db: Db = {
      async query(sql, params) {
        assert.ok(/where\s+id\s*=\s*\$1/i.test(sql.toLowerCase()));
        assert.deepEqual(params, ['c1']);
        return { rows: [{ id: 'c1', name: 'Alice', email: null, phone: null, instagram: null, notes: null }] };
      }
    };

    const row = await getContactById(db, 'c1');
    assert.equal(row?.id, 'c1');
  }

  // updateContact builds update and returns row; null if not found
  {
    const db: Db = {
      async query(sql, params) {
        assert.ok(/update\s+contacts/i.test(sql));
        assert.ok(/set/i.test(sql));
        assert.ok(/updated_at\s*=\s*now\(\)/i.test(sql.toLowerCase()));
        assert.ok(/where\s+id\s*=\s*\$\d+/i.test(sql.toLowerCase()));
        assert.ok(Array.isArray(params));
        assert.equal(params?.[params.length - 1], 'c1');
        return { rows: [{ id: 'c1', name: 'Bob', email: null, phone: null, instagram: null, notes: null }] };
      }
    };

    const row = await updateContact(db, 'c1', { name: ' Bob ' });
    assert.equal(row?.id, 'c1');
  }

  {
    const db: Db = {
      async query() {
        return { rows: [] };
      }
    };

    const row = await updateContact(db, 'missing', { name: 'Bob' });
    assert.equal(row, null);
  }

  console.log('PASS: contacts helper unit tests passed');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL: contacts helper unit tests failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});
