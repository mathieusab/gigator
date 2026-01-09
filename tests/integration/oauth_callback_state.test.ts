import assert from 'node:assert/strict';
import { URL } from 'node:url';

// tests/integration/oauth_callback_state.test.ts
// Integration-ish test (in-process) for OAuth callback state validation / consumption.
// Run with: npx tsx tests/integration/oauth_callback_state.test.ts

function setTestEnv() {
  // Ensure env is set BEFORE importing any backend modules (they snapshot env at import time).
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.GOOGLE_OAUTH_REDIRECT_URI = 'http://localhost:3000/api/sync/gmail/callback';

  // Callback route is feature-flagged (out-of-scope for GIG-001 by default).
  process.env.ENABLE_GMAIL_OAUTH_CALLBACK = 'true';

  // Force in-memory oauth state store (avoid Redis connect in tests).
  process.env.REDIS_URL = '';
  process.env.OAUTH_STATE_TTL = '600';

  // oauth.ts imports pg and instantiates a Pool at module load time; it should not connect unless used.
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:pass@127.0.0.1:5432/db';
}

function stubFetchToFailTokenExchange() {
  // Make sure callback flow fails before DB access:
  // handleOAuthCallback() validates+deletes state, then does token exchange fetch().
  // By forcing token exchange to fail, we can assert state is consumed without needing a real DB.
  const TOKEN_URL = process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';

  // Minimal Response-like object used by oauth.ts
  globalThis.fetch = (async (url: any) => {
    const u = String(url);
    if (u === TOKEN_URL) {
      return {
        ok: false,
        status: 400,
        async json() {
          return { error: 'invalid_grant' };
        }
      } as any;
    }

    // Anything else should not be reached in this test.
    return {
      ok: false,
      status: 500,
      async json() {
        return { error: 'unexpected_fetch' };
      }
    } as any;
  }) as any;
}

async function main() {
  setTestEnv();
  stubFetchToFailTokenExchange();

  const fastifyModule = await import('fastify');
  const fastify = fastifyModule.default({ logger: false });

  const routesMod = await import('../../app/backend/routes/auth_google.ts');
  const authGoogleRoutes: (f: any) => Promise<void> = routesMod.default;
  await fastify.register(authGoogleRoutes);

  const storeMod = await import('../../app/backend/lib/oauth_state_store.ts');
  const getOauthState: typeof storeMod.getOauthState = storeMod.getOauthState;

  // Case 1: Missing state => 400 invalid_oauth_state
  {
    const res = await fastify.inject({
      method: 'GET',
      url: '/api/sync/gmail/callback?code=FAKE_CODE'
    });

    assert.equal(res.statusCode, 400, `expected 400, got ${res.statusCode}. body=${res.body}`);
    const body = JSON.parse(res.body);
    assert.equal(body?.error, 'invalid_oauth_state');
  }

  // Case 2: Unknown state => 400 invalid_oauth_state
  {
    const res = await fastify.inject({
      method: 'GET',
      url: '/api/sync/gmail/callback?code=FAKE_CODE&state=deadbeef'
    });

    assert.equal(res.statusCode, 400, `expected 400, got ${res.statusCode}. body=${res.body}`);
    const body = JSON.parse(res.body);
    assert.equal(body?.error, 'invalid_oauth_state');
  }

  // Case 3: Valid state should be consumed (one-time), even if exchange fails later
  {
    const startRes = await fastify.inject({
      method: 'POST',
      url: '/api/sync/gmail/start'
    });
    assert.equal(startRes.statusCode, 200, `expected 200, got ${startRes.statusCode}. body=${startRes.body}`);

    const startBody = JSON.parse(startRes.body);
    const oauthUrl: string = startBody?.oauth_url;
    assert.equal(typeof oauthUrl, 'string', 'oauth_url missing or not a string');

    const u = new URL(oauthUrl);
    const state = u.searchParams.get('state');
    assert.ok(state, 'state missing from oauth_url');

    // state should exist in store right after /start
    const before = await getOauthState(state!);
    assert.ok(before, 'expected oauth state to be persisted before callback');

    // Now hit callback; token exchange is stubbed to fail => 500 oauth_exchange_failed,
    // BUT state should be deleted already (one-time use).
    const cbRes = await fastify.inject({
      method: 'GET',
      url: `/api/sync/gmail/callback?code=FAKE_CODE&state=${encodeURIComponent(state!)}`
    });

    assert.equal(cbRes.statusCode, 500, `expected 500, got ${cbRes.statusCode}. body=${cbRes.body}`);
    const cbBody = JSON.parse(cbRes.body);
    assert.equal(cbBody?.error, 'oauth_exchange_failed', 'expected oauth_exchange_failed after token exchange failure');

    const after = await getOauthState(state!);
    assert.equal(after, null, 'expected oauth state to be consumed (deleted) after callback attempt');
  }

  await fastify.close();

  console.log('PASS: oauth callback state validation/consumption test passed');
  process.exit(0);
}

main().catch(async (err) => {
  console.error('FAIL: oauth callback state validation/consumption test failed');
  console.error(err && (err as any).stack ? (err as any).stack : err);
  process.exit(1);
});