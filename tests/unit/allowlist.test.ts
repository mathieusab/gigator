import assert from 'node:assert/strict';

// tests/unit/allowlist.test.ts
// Unit test for allowlist DB query helper
// Run with: npx tsx tests/unit/allowlist.test.ts

type Db = {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
};

async function main() {
  const mod = await import('../../app/backend/lib/allowlist.ts');
  const isEmailAllowed: (db: Db, email: string) => Promise<boolean> = mod.isEmailAllowed;

  // Case 1: Allowed when row exists and is_active=true
  {
    const db: Db = {
      async query(sql, params) {
        assert.ok(sql.toLowerCase().includes('from app_email_allowlist'));
        assert.deepEqual(params, ['user@example.com']);
        return { rows: [{ is_active: true }] };
      }
    };

    const ok = await isEmailAllowed(db, '  User@Example.com  ');
    assert.equal(ok, true);
  }

  // Case 2: Denied when no rows
  {
    const db: Db = {
      async query() {
        return { rows: [] };
      }
    };

    const ok = await isEmailAllowed(db, 'missing@example.com');
    assert.equal(ok, false);
  }

  // Case 3: Denied when row exists but is_active=false
  {
    const db: Db = {
      async query() {
        return { rows: [{ is_active: false }] };
      }
    };

    const ok = await isEmailAllowed(db, 'disabled@example.com');
    assert.equal(ok, false);
  }

  console.log('PASS: allowlist helper unit test passed');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL: allowlist helper unit test failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});
