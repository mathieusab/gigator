import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

// tests/unit/contacts.schema.test.ts
// Verifies DB schema/migration for contacts + contact_venues exists.
// Run with: npx tsx tests/unit/contacts.schema.test.ts

async function readText(filePath: string): Promise<string> {
  return await fs.readFile(filePath, 'utf8');
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const repoRoot = path.resolve(__dirname, '../..');

  const schemaPath = path.join(repoRoot, 'db/schema.sql');
  const migrationPath = path.join(repoRoot, 'db/migrations/0005_create_contacts_and_links.sql');

  const schema = await readText(schemaPath);

  assert.ok(
    /create\s+table\s+if\s+not\s+exists\s+contacts\b/i.test(schema),
    'db/schema.sql should define contacts table'
  );

  assert.ok(/\bname\b/i.test(schema), 'contacts should include name column');
  assert.ok(/\bemail\b/i.test(schema), 'contacts should include email column');
  assert.ok(/\bphone\b/i.test(schema), 'contacts should include phone column');
  assert.ok(/\binstagram\b/i.test(schema), 'contacts should include instagram column');
  assert.ok(/\bnotes\b/i.test(schema), 'contacts should include notes column');

  assert.ok(
    /create\s+table\s+if\s+not\s+exists\s+contact_venues\b/i.test(schema),
    'db/schema.sql should define contact_venues table'
  );

  assert.ok(
    /unique\s*\(\s*contact_id\s*,\s*venue_id\s*\)/i.test(schema),
    'contact_venues should enforce UNIQUE(contact_id, venue_id)'
  );

  assert.equal(
    await fileExists(migrationPath),
    true,
    'Expected migration db/migrations/0005_create_contacts_and_links.sql to exist'
  );

  const migration = await readText(migrationPath);

  assert.ok(
    /create\s+table\s+if\s+not\s+exists\s+contacts\b/i.test(migration),
    'migration should create contacts table'
  );

  assert.ok(
    /create\s+table\s+if\s+not\s+exists\s+contact_venues\b/i.test(migration),
    'migration should create contact_venues table'
  );

  assert.ok(
    /unique\s*\(\s*contact_id\s*,\s*venue_id\s*\)/i.test(migration),
    'migration should enforce UNIQUE(contact_id, venue_id)'
  );

  console.log('PASS: contacts schema/migration presence test passed');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL: contacts schema/migration presence test failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});
