import assert from 'node:assert/strict';

// tests/unit/admin_members.test.ts
// Unit tests for admin member allowlist DB helpers
// Run with: npx tsx tests/unit/admin_members.test.ts

async function importFresh<T = any>(modulePath: string): Promise<T> {
  return (await import(`${modulePath}?t=${Date.now()}-${Math.random()}`)) as any;
}

async function main() {
  const mod = await importFresh<any>('../../app/backend/lib/admin_members.ts');
  const listMembers: (db: any) => Promise<any[]> = mod.listMembers;
  const upsertInvite: (db: any, email: string) => Promise<any> = mod.upsertInvite;
  const setMemberActive: (db: any, id: string, isActive: boolean) => Promise<any> = mod.setMemberActive;

  // listMembers
  {
    let lastSql = '';
    const db = {
      async query(sql: string) {
        lastSql = sql;
        return {
          rows: [
            {
              id: 'id-1',
              email: 'a@example.com',
              is_active: true,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-02T00:00:00Z'
            }
          ]
        };
      }
    };

    const rows = await listMembers(db);
    assert.equal(rows.length, 1);
    assert.ok(lastSql.includes('FROM app_email_allowlist'));
    assert.equal(rows[0].email, 'a@example.com');
  }

  // upsertInvite normalizes + returns row
  {
    let gotParams: any[] | undefined;
    const db = {
      async query(_sql: string, params?: any[]) {
        gotParams = params;
        return {
          rows: [
            {
              id: 'id-2',
              email: String(params?.[0] ?? ''),
              is_active: true,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-02T00:00:00Z'
            }
          ]
        };
      }
    };

    const row = await upsertInvite(db, '  User@Example.com  ');
    assert.equal(gotParams?.[0], 'user@example.com');
    assert.equal(row.is_active, true);
  }

  // upsertInvite invalid email
  {
    const db = { async query() { return { rows: [] }; } };
    await assert.rejects(() => upsertInvite(db, '   '), /invalid_email/);
  }

  // setMemberActive returns null if no row
  {
    const db = { async query() { return { rows: [] }; } };
    const row = await setMemberActive(db, 'id-x', false);
    assert.equal(row, null);
  }

  console.log('PASS: admin_members unit tests passed');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL: admin_members unit tests failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});
