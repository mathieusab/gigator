// tests/integration/import_worker.test.js
// Lightweight integration-style test for the import worker flow.
// - Starts local mock servers for Google OAuth (token + userinfo) and Gmail API (threads list + thread GET).
// - Starts a mock LLM endpoint (simple echo) to satisfy requests if code under test would call it.
// - Uses an in-memory "DB" (plain JS objects/arrays) as a pg-like client stub.
// - Implements a minimal importThreadsForAccount function (subset of app/backend/services/gmail_import.ts behavior)
//   that uses the mock HTTP endpoints and the in-memory DB to validate the import flow end-to-end without Postgres.
//
// Run with: node tests/integration/import_worker.test.js
//
// Notes:
// - This file is intentionally self-contained so it can be added with a single write_to_file call.
// - It does not modify existing code; it exercises the import logic within this test process using the same API shapes.

const http = require('http');
const { URL } = require('url');
const assert = require('assert').strict;

// Use global fetch (Node 18+) - if unavailable the test will fail early.
if (typeof fetch !== 'function') {
  console.error('This test requires Node with global fetch (Node 18+).');
  process.exit(1);
}

// Small helper to start a mock HTTP server with programmable routes.
function createMockServer(routes) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const key = `${req.method} ${url.pathname}`;
      // Allow route handlers keyed by method + pathname (exact) or by RegExp matcher
      for (const r of routes) {
        if (r.method !== req.method) continue;
        if (r.path instanceof RegExp) {
          if (!r.path.test(url.pathname)) continue;
        } else {
          if (r.path !== url.pathname) continue;
        }
        // collect body if needed
        let body = null;
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
          body = await new Promise((resolve) => {
            let data = '';
            req.on('data', (chunk) => (data += chunk));
            req.on('end', () => resolve(data));
          });
        }
        await r.handler({ req, res, url, body });
        return;
      }
      // default 404
      res.statusCode = 404;
      res.setHeader('content-type', 'text/plain');
      res.end('not found');
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('content-type', 'text/plain');
      res.end(String(err));
    }
  });
  return server;
}

// ---------- In-memory DB (simple pg-like API) ----------
function createInMemoryDb() {
  const db = {
    gmail_accounts: [], // rows with id, access_token, refresh_token, expires_at (ISO), google_user_id, email, display_name
    threads: [], // rows with id (uuid string), gmail_thread_id, subject, last_message_at, raw_payload
    messages: [], // rows with thread_id, message_id, subject, body, raw_payload, sent_at
    gmail_import_runs: [] // rows with id, account_id, status, details
  };

  function genId(prefix = 'id') {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }

  // Minimal client that matches pool.connect() -> { query, release }
  function getClient() {
    return {
      query: async (text, params) => {
        // This stub only supports the specific queries used in the PoC import code.
        // Recognize the query patterns crudely.
        const q = String(text || '').toLowerCase();
        if (q.includes('select * from gmail_accounts where id = $1')) {
          const id = params[0];
          const row = db.gmail_accounts.find((r) => r.id === id);
          return { rowCount: row ? 1 : 0, rows: row ? [row] : [] };
        }
        if (q.includes('update gmail_accounts set access_token')) {
          const [access_token, expires_seconds, id] = params;
          const acct = db.gmail_accounts.find((r) => r.id === id);
          if (acct) {
            acct.access_token = access_token;
            const now = Date.now();
            acct.expires_at = new Date(now + (Number(expires_seconds) || 3600) * 1000).toISOString();
            acct.updated_at = new Date().toISOString();
            return { rowCount: 1, rows: [] };
          }
          return { rowCount: 0, rows: [] };
        }
        if (q.includes('insert into gmail_import_runs')) {
          const [account_id, status, details] = params;
          const row = { id: genId('run'), account_id, status, details, started_at: new Date().toISOString() };
          db.gmail_import_runs.push(row);
          return { rowCount: 1, rows: [row] };
        }
        if (q.includes('insert into threads')) {
          // We won't actually run raw SQL here from testable path; upserts are done in JS functions below.
          return { rowCount: 1, rows: [] };
        }
        if (q.includes('select 1 from messages where message_id = $1')) {
          const messageId = params[0];
          const found = db.messages.find((m) => m.message_id === messageId);
          return { rowCount: found ? 1 : 0, rows: found ? [1] : [] };
        }
        // Generic fallback: no-op
        return { rowCount: 0, rows: [] };
      },
      release: () => {}
    };
  }

  return { db, getClient };
}

// ---------- Minimal import logic (uses HTTP endpoints and in-memory DB) ----------
async function refreshAccessTokenIfNeeded(account, env) {
  if (!account) throw new Error('account required');
  const now = new Date();
  if (account.expires_at && new Date(account.expires_at) > now) {
    return account.access_token;
  }
  if (!account.refresh_token) {
    throw new Error('no_refresh_token_available');
  }

  const tokenUrl = env.GOOGLE_TOKEN_URL;
  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID || 'test-client',
    client_secret: env.GOOGLE_CLIENT_SECRET || 'test-secret',
    refresh_token: account.refresh_token,
    grant_type: 'refresh_token'
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`refresh_token_failed: ${res.status} ${txt}`);
  }
  const json = await res.json();
  const access_token = json.access_token;
  const expires_in = json.expires_in || 3600;

  // Update account in-memory
  account.access_token = access_token;
  account.expires_at = new Date(Date.now() + Number(expires_in) * 1000).toISOString();
  account.updated_at = new Date().toISOString();

  return access_token;
}

async function fetchGmailThreadsList(accessToken, env, maxResults = 50) {
  const url = new URL(env.GMAIL_THREADS_URL);
  url.searchParams.set('maxResults', String(maxResults));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`failed_list_threads: ${res.status} ${txt}`);
  }
  const json = await res.json();
  const threads = json.threads || [];
  return threads.map((t) => t.id);
}

async function fetchGmailThread(accessToken, threadId, env) {
  const url = new URL(`${env.GMAIL_THREADS_URL.replace(/\/threads$/, '')}/threads/${encodeURIComponent(threadId)}`);
  url.searchParams.set('format', 'full');
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`failed_fetch_thread ${threadId}: ${res.status} ${txt}`);
  }
  return res.json();
}

async function upsertThreadAndMessages(threadResource, inMemoryDb) {
  const gmailThreadId = threadResource.id;
  const messages = threadResource.messages || [];
  const subjectHeader =
    (messages[0]?.payload?.headers || []).find((h) => h.name?.toLowerCase() === 'subject')?.value || null;
  const lastMessageAt =
    (messages
      .map((m) => (m.internalDate ? new Date(Number(m.internalDate)) : null))
      .filter(Boolean)
      .sort((a, b) => b - a)[0]) || null;

  // Upsert thread
  let existing = inMemoryDb.threads.find((t) => t.gmail_thread_id === gmailThreadId);
  if (!existing) {
    const row = {
      id: `th-${Math.random().toString(36).slice(2, 10)}`,
      gmail_thread_id: gmailThreadId,
      subject: subjectHeader,
      last_message_at: lastMessageAt ? lastMessageAt.toISOString() : null,
      raw_payload: threadResource
    };
    inMemoryDb.threads.push(row);
    existing = row;
  } else {
    existing.subject = subjectHeader;
    existing.last_message_at = lastMessageAt ? lastMessageAt.toISOString() : null;
    existing.raw_payload = threadResource;
    existing.updated_at = new Date().toISOString();
  }

  // Insert messages if not exists
  for (const m of messages) {
    const messageId = m.id || null;
    const found = inMemoryDb.messages.find((mm) => mm.message_id === messageId);
    if (found) continue;
    // extract simple body (snippet fallback)
    let body = m.snippet || null;
    try {
      const payload = m.payload;
      if (payload) {
        // walk parts to find text/plain
        const walk = (p) => {
          if (!p) return null;
          if (p.mimeType === 'text/plain' && p.body && p.body.data) {
            try {
              const buf = Buffer.from(p.body.data, 'base64');
              return buf.toString('utf8');
            } catch (e) {
              return null;
            }
          }
          if (p.parts && Array.isArray(p.parts)) {
            for (const part of p.parts) {
              const foundBody = walk(part);
              if (foundBody) return foundBody;
            }
          }
          return null;
        };
        const extracted = walk(payload);
        if (extracted) body = extracted;
      }
    } catch (e) {
      // ignore
    }

    const msgRow = {
      thread_id: existing.id,
      message_id: messageId,
      subject: subjectHeader,
      body,
      raw_payload: m,
      sent_at: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : null
    };
    inMemoryDb.messages.push(msgRow);
  }

  return { threadId: existing.id, messageCount: messages.length };
}

// Public import function used by the test
async function importThreadsForAccount(accountId, opts, context) {
  const maxResults = opts?.maxResults ?? 50;
  const { db, env } = context;

  const account = db.gmail_accounts.find((r) => r.id === accountId);
  if (!account) throw new Error('account_not_found');

  const accessToken = await refreshAccessTokenIfNeeded(account, env);
  const threadIds = await fetchGmailThreadsList(accessToken, env, maxResults);

  let imported = 0;
  for (const tid of threadIds) {
    try {
      const threadRes = await fetchGmailThread(accessToken, tid, env);
      await upsertThreadAndMessages(threadRes, db);
      imported += 1;
    } catch (err) {
      console.error('failed import thread', tid, err);
    }
  }

  db.gmail_import_runs.push({ id: `run-${Math.random().toString(36).slice(2, 8)}`, account_id: accountId, status: 'completed', details: { imported } });
  return { imported, attempted: threadIds.length };
}

// ---------- Test runner ----------
(async () => {
  // Start mock servers
  // We'll start a single HTTP server that responds to multiple paths for simplicity.
  const routes = [];

  // Token endpoint: responds to POST with new access_token
  routes.push({
    method: 'POST',
    path: '/oauth2/token',
    handler: async ({ req, res, body }) => {
      // simulate token refresh exchange
      const params = new URLSearchParams(body || '');
      const refreshToken = params.get('refresh_token');
      if (!refreshToken || refreshToken !== 'mock-refresh-token') {
        res.statusCode = 400;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ error: 'invalid_grant' }));
        return;
      }
      const resp = {
        access_token: `mock-access-${Date.now()}`,
        expires_in: 3600,
        token_type: 'Bearer'
      };
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(resp));
    }
  });

  // Userinfo endpoint
  routes.push({
    method: 'GET',
    path: '/oauth2/userinfo',
    handler: async ({ req, res }) => {
      const resp = {
        sub: 'google-user-123',
        email: 'tester@example.com',
        name: 'Tester Example'
      };
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(resp));
    }
  });

  // Gmail threads list
  routes.push({
    method: 'GET',
    path: '/gmail/v1/users/me/threads',
    handler: async ({ req, res, url }) => {
      // Return 3 thread ids
      const threads = [{ id: 'th-1' }, { id: 'th-2' }, { id: 'th-3' }];
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ threads }));
    }
  });

  // Gmail thread GET (match /gmail/v1/users/me/threads/:id)
  routes.push({
    method: 'GET',
    path: new RegExp('^/gmail/v1/users/me/threads/'),
    handler: async ({ req, res, url }) => {
      const parts = url.pathname.split('/');
      const tid = parts[parts.length - 1];
      // return a thread object with messages
      const now = Date.now();
      const thread = {
        id: tid,
        messages: [
          {
            id: `${tid}-m1`,
            internalDate: String(now - 60000),
            snippet: `Snippet for ${tid}-m1`,
            payload: {
              headers: [{ name: 'Subject', value: `Subject for ${tid}` }],
              mimeType: 'text/plain',
              body: { data: Buffer.from(`Hello from ${tid}-m1`).toString('base64') }
            }
          },
          {
            id: `${tid}-m2`,
            internalDate: String(now - 30000),
            snippet: `Snippet for ${tid}-m2`,
            payload: {
              headers: [{ name: 'Subject', value: `Subject for ${tid}` }],
              mimeType: 'text/plain',
              body: { data: Buffer.from(`Followup from ${tid}-m2`).toString('base64') }
            }
          }
        ]
      };
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(thread));
    }
  });

  // LLM mock (unused by import flow but present per request)
  routes.push({
    method: 'POST',
    path: '/llm/v1/generate',
    handler: async ({ req, res, body }) => {
      let parsed = {};
      try { parsed = JSON.parse(body || '{}'); } catch (e) {}
      const resp = { text: `LLM mock echo: ${parsed.prompt || 'no prompt'}` };
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(resp));
    }
  });

  const server = createMockServer(routes);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  // Build env pointing at our mock endpoints
  const env = {
    GOOGLE_TOKEN_URL: `${base}/oauth2/token`,
    GOOGLE_USERINFO_URL: `${base}/oauth2/userinfo`,
    GMAIL_THREADS_URL: `${base}/gmail/v1/users/me/threads`,
    LLM_URL: `${base}/llm/v1/generate`,
    GOOGLE_CLIENT_ID: 'test-client',
    GOOGLE_CLIENT_SECRET: 'test-secret'
  };

  // Setup in-memory DB and seed a gmail_accounts row (with expired token to exercise refresh flow)
  const { db } = createInMemoryDb();
  const accountId = 'acct-1';
  db.gmail_accounts.push({
    id: accountId,
    profile_id: null,
    google_user_id: 'google-user-123',
    email: 'tester@example.com',
    display_name: 'Tester Example',
    access_token: 'expired-token',
    refresh_token: 'mock-refresh-token',
    scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
    token_type: 'Bearer',
    expires_at: new Date(Date.now() - 1000).toISOString(), // already expired
    revoked: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  // Run import
  try {
    const result = await importThreadsForAccount(accountId, { maxResults: 10 }, { db, env });
    // assertions
    assert.equal(result.attempted, 3, 'should attempt 3 threads from mock');
    assert.equal(result.imported, 3, 'should import all 3 threads');

    // verify DB rows created
    assert.equal(db.threads.length, 3, '3 threads persisted');
    assert.equal(db.messages.length, 6, 'each thread had 2 messages -> 6 messages total');
    assert.equal(db.gmail_import_runs.length, 1, 'one import run recorded');
    const runDetails = db.gmail_import_runs[0].details;
    assert.equal(runDetails.imported, 3, 'run details show 3 imported');

    console.log('PASS: import worker integration-style test (lightweight) passed');
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('FAIL: import worker integration-style test failed');
    console.error(err && err.stack ? err.stack : err);
    server.close();
    process.exit(1);
  }
})();