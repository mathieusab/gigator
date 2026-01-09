import assert from 'node:assert/strict';

// tests/unit/allowlist.env.test.ts
// Unit tests for isEmailAllowedByEnv
// Run with: npx tsx tests/unit/allowlist.env.test.ts

async function main() {
  const mod = await import('../../app/backend/lib/allowlist.ts');
  const isEmailAllowedByEnv: (email: string) => boolean | null = mod.isEmailAllowedByEnv;

  const original = process.env.APP_EMAIL_ALLOWLIST;
  try {
    // Case 1: No env set -> null
    delete process.env.APP_EMAIL_ALLOWLIST;
    assert.equal(isEmailAllowedByEnv('user@example.com'), null);

    // Case 2: Single value, exact match and case-insensitive
    process.env.APP_EMAIL_ALLOWLIST = 'allowed@example.com';
    assert.equal(isEmailAllowedByEnv('allowed@example.com'), true);
    assert.equal(isEmailAllowedByEnv('Allowed@Example.com'), true);
    assert.equal(isEmailAllowedByEnv('missing@example.com'), false);

    // Case 3: CSV values with spaces and mixed case
    process.env.APP_EMAIL_ALLOWLIST = ' alpha@ex.com ,BETA@EX.COM,  gamma@ex.com  ';
    assert.equal(isEmailAllowedByEnv('alpha@ex.com'), true);
    assert.equal(isEmailAllowedByEnv('beta@ex.com'), true);
    assert.equal(isEmailAllowedByEnv(' GAmMa@EX.com '), true);

    // Case 4: Empty string env -> treated as not set -> null
    process.env.APP_EMAIL_ALLOWLIST = '';
    assert.equal(isEmailAllowedByEnv('x@x.com'), null);

    console.log('PASS: allowlist env helper unit test passed');
    process.exit(0);
  } catch (err) {
    console.error('FAIL: allowlist env helper unit test failed');
    console.error(err && (err as any).stack ? (err as any).stack : err);
    process.exit(1);
  } finally {
    if (original === undefined) delete process.env.APP_EMAIL_ALLOWLIST; else process.env.APP_EMAIL_ALLOWLIST = original;
  }
}

main();
