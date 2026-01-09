import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

// tests/unit/venues.schema.test.ts
// Verifies DB schema/migration for venues exists.
// Run with: npx tsx tests/unit/venues.schema.test.ts

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
  const migrationPath = path.join(repoRoot, 'db/migrations/0004_create_venues.sql');

  const schema = await readText(schemaPath);

  assert.ok(
    /create\s+table\s+if\s+not\s+exists\s+venues\b/i.test(schema),
    'db/schema.sql should define venues table'
  );

  assert.ok(/\bname\b/i.test(schema) && /\bcity\b/i.test(schema), 'venues should include name and city columns');

  assert.equal(
    await fileExists(migrationPath),
    true,
    'Expected migration db/migrations/0004_create_venues.sql to exist'
  );

  const migration = await readText(migrationPath);
  assert.ok(
    /create\s+table\s+if\s+not\s+exists\s+venues\b/i.test(migration),
    'migration should create venues table'
  );

  console.log('PASS: venues schema/migration presence test passed');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL: venues schema/migration presence test failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});
