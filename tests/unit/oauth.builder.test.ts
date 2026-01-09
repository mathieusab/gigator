import assert from 'node:assert/strict';
import { URL } from 'node:url';

// tests/unit/oauth.builder.test.ts
// Unit-ish test for app/backend/controllers/oauth.ts getAuthUrl()
// Run with: npx tsx tests/unit/oauth.builder.test.ts

async function main() {
  // Set env BEFORE importing the module under test (safest pattern for modules that may read env during init).
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.GOOGLE_OAUTH_REDIRECT_URI = 'http://localhost:3000/api/sync/gmail/callback';

  // Avoid attempts to connect to Redis in unit test.
  process.env.REDIS_URL = '';
  process.env.OAUTH_STATE_TTL = '600';

  // oauth.ts imports pg and instantiates a Pool at module load time; it should not connect unless used.
  // Provide a harmless-looking connection string so pg config parsing doesn't fail in some environments.
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:pass@127.0.0.1:5432/db';

  const mod = await import('../../app/backend/controllers/oauth.ts');
  const getAuthUrl: typeof mod.getAuthUrl = mod.getAuthUrl;

  const result = await getAuthUrl({ returnObject: true });
  assert.equal(typeof result.oauth_url, 'string', 'oauth_url should be a string');
  assert.equal(typeof result.state, 'string', 'state should be a string');

  // State should be 24 bytes hex => 48 hex chars
  assert.match(result.state, /^[0-9a-f]{48}$/i, 'state should look like 24 random bytes hex');

  const expectedPrefix = 'https://accounts.google.com/o/oauth2/v2/auth?';
  assert.ok(
    result.oauth_url.startsWith(expectedPrefix),
    `oauth_url should start with ${expectedPrefix} (got: ${result.oauth_url})`
  );

  const u = new URL(result.oauth_url);

  // Required query params
  assert.equal(u.searchParams.get('client_id'), 'test-client-id', 'client_id param mismatch');
  assert.equal(
    u.searchParams.get('redirect_uri'),
    'http://localhost:3000/api/sync/gmail/callback',
    'redirect_uri param mismatch'
  );
  assert.equal(u.searchParams.get('response_type'), 'code', 'response_type should be code');

  const scope = u.searchParams.get('scope') || '';
  assert.ok(scope.includes('openid'), 'scope should include openid');
  assert.ok(scope.includes('email'), 'scope should include email');
  assert.ok(scope.includes('profile'), 'scope should include profile');
  assert.ok(
    scope.includes('https://www.googleapis.com/auth/gmail.readonly'),
    'scope should include gmail.readonly'
  );

  // State should appear in URL and match returned state
  assert.equal(u.searchParams.get('state'), result.state, 'state param should match returned state');

  console.log('PASS: getAuthUrl() builder unit test passed');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL: getAuthUrl() builder unit test failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});