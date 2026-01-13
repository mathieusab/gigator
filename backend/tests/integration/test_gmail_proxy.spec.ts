import request from 'supertest';
import { expect, test, vi, describe, beforeEach } from 'vitest';

import { createApp } from '../../src/app';

vi.mock('../../src/lib/supabaseJwt', () => {
  return {
    getBearerTokenFromHeader: (v: string | undefined) => {
      const m = String(v ?? '').match(/^Bearer\s+(.+)$/i);
      return m?.[1]?.trim() ?? '';
    },
    verifySupabaseAccessToken: async (_token: string) => ({ userId: 'user-1' }),
  };
});

vi.mock('../../src/lib/supabaseAdmin', () => {
  const appUserRow = { id: 'user-1', is_active: true };
  let gmailConn: any = null;

  return {
    __setGmailConnection: (conn: any) => {
      gmailConn = conn;
    },
    getSupabaseAdmin: () => ({
      from: (table: string) => {
        if (table === 'app_users') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: appUserRow, error: null }),
              }),
            }),
          };
        }
        if (table === 'gmail_connections') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: gmailConn, error: null }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      },
    }),
  };
});

vi.mock('../../src/lib/cryptoTokens', () => {
  return {
    decryptToken: () => 'test-refresh-token',
    encryptToken: () => ({ ciphertextB64: 'x', ivB64: 'y', tagB64: 'z' }),
    hmacSha256Base64Url: () => 'sig',
  };
});

function mockFetchSequence(responses: Array<{ status: number; json: unknown }>) {
  const fetchMock = vi.fn();
  for (const r of responses) {
    fetchMock.mockImplementationOnce(async () => {
      return {
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        json: async () => r.json,
      } as any;
    });
  }
  vi.stubGlobal('fetch', fetchMock as any);
  return fetchMock;
}

describe('GET /gmail/threads', () => {
  beforeEach(() => {
    process.env.GMAIL_PROXY_CLIENT_ID = 'test-client-id';
    process.env.GMAIL_PROXY_CLIENT_SECRET = 'test-client-secret';
    process.env.GMAIL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32).toString('base64');
  });

  test('returns threads (happy path)', async () => {
    // Simulate that the user has connected Gmail.
    const supabaseAdmin = await import('../../src/lib/supabaseAdmin');
    (supabaseAdmin as any).__setGmailConnection({
      refresh_token_ciphertext: 'cipher',
      refresh_token_iv: 'iv',
      refresh_token_tag: 'tag',
    });

    mockFetchSequence([
      {
        status: 200,
        json: { access_token: 'gmail-access-token' },
      },
      {
        status: 200,
        json: { threads: [{ id: 't1' }, { id: 't2' }] },
      },
      {
        status: 200,
        json: {
          id: 't1',
          snippet: 'Thread 1 snippet',
          historyId: 'h1',
          messages: [
            { id: 'm1', threadId: 't1', snippet: 'msg', internalDate: String(Date.now()) },
          ],
        },
      },
      {
        status: 200,
        json: {
          id: 't2',
          snippet: 'Thread 2 snippet',
          historyId: 'h2',
          messages: [],
        },
      },
    ]);

    const app = createApp();
    const res = await request(app)
      .get('/gmail/threads')
      .query({ email: 'contact@example.com' })
      .set('Authorization', 'Bearer supabase-access-token')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body[0]).toMatchObject({ id: 't1', snippet: 'Thread 1 snippet' });
  });

  test('returns empty array when no results', async () => {
    const supabaseAdmin = await import('../../src/lib/supabaseAdmin');
    (supabaseAdmin as any).__setGmailConnection({
      refresh_token_ciphertext: 'cipher',
      refresh_token_iv: 'iv',
      refresh_token_tag: 'tag',
    });

    mockFetchSequence([
      {
        status: 200,
        json: { access_token: 'gmail-access-token' },
      },
      {
        status: 200,
        json: { threads: [] },
      },
    ]);

    const app = createApp();
    const res = await request(app)
      .get('/gmail/threads')
      .query({ email: 'nobody@example.com' })
      .set('Authorization', 'Bearer supabase-access-token')
      .expect(200);

    expect(res.body).toEqual([]);
  });

  test('401 when missing Authorization token', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/gmail/threads')
      .query({ email: 'contact@example.com' })
      .expect(401);
    expect(res.body).toMatchObject({ error: 'Missing Authorization Bearer token' });
  });

  test('401 when Gmail is not connected', async () => {
    const supabaseAdmin = await import('../../src/lib/supabaseAdmin');
    (supabaseAdmin as any).__setGmailConnection(null);

    mockFetchSequence([
      {
        status: 200,
        json: { access_token: 'gmail-access-token' },
      },
    ]);

    const app = createApp();
    const res = await request(app)
      .get('/gmail/threads')
      .query({ email: 'contact@example.com' })
      .set('Authorization', 'Bearer supabase-access-token')
      .expect(401);

    expect(res.body.error).toContain('Gmail not connected');
  });
});

describe('GET /gmail/threads/:threadId', () => {
  beforeEach(() => {
    process.env.GMAIL_PROXY_CLIENT_ID = 'test-client-id';
    process.env.GMAIL_PROXY_CLIENT_SECRET = 'test-client-secret';
    process.env.GMAIL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32).toString('base64');
  });

  test('returns full thread with decoded body (happy path)', async () => {
    const supabaseAdmin = await import('../../src/lib/supabaseAdmin');
    (supabaseAdmin as any).__setGmailConnection({
      refresh_token_ciphertext: 'cipher',
      refresh_token_iv: 'iv',
      refresh_token_tag: 'tag',
    });

    // "hello" in base64url is aGVsbG8
    mockFetchSequence([
      { status: 200, json: { access_token: 'gmail-access-token' } },
      {
        status: 200,
        json: {
          id: 't1',
          snippet: 'Thread snippet',
          messages: [
            {
              id: 'm1',
              threadId: 't1',
              internalDate: String(Date.now()),
              payload: {
                mimeType: 'text/plain',
                headers: [
                  { name: 'Subject', value: 'Hello' },
                  { name: 'From', value: 'Sender <sender@example.com>' },
                ],
                body: { data: 'aGVsbG8' },
              },
            },
          ],
        },
      },
    ]);

    const app = createApp();
    const res = await request(app)
      .get('/gmail/threads/t1')
      .set('Authorization', 'Bearer supabase-access-token')
      .expect(200);

    expect(res.body).toMatchObject({ id: 't1' });
    expect(res.body.messages?.[0]?.bodyText).toBe('hello');
    expect(res.body.messages?.[0]?.headers?.subject).toBe('Hello');
  });
});

describe('GET /gmail/messages/:messageId', () => {
  beforeEach(() => {
    process.env.GMAIL_PROXY_CLIENT_ID = 'test-client-id';
    process.env.GMAIL_PROXY_CLIENT_SECRET = 'test-client-secret';
    process.env.GMAIL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32).toString('base64');
  });

  test('returns message with decoded body (happy path)', async () => {
    const supabaseAdmin = await import('../../src/lib/supabaseAdmin');
    (supabaseAdmin as any).__setGmailConnection({
      refresh_token_ciphertext: 'cipher',
      refresh_token_iv: 'iv',
      refresh_token_tag: 'tag',
    });

    mockFetchSequence([
      { status: 200, json: { access_token: 'gmail-access-token' } },
      {
        status: 200,
        json: {
          id: 'm1',
          threadId: 't1',
          internalDate: String(Date.now()),
          payload: {
            mimeType: 'text/plain',
            headers: [{ name: 'Subject', value: 'Only one message' }],
            body: { data: 'aGVsbG8' },
          },
        },
      },
    ]);

    const app = createApp();
    const res = await request(app)
      .get('/gmail/messages/m1')
      .set('Authorization', 'Bearer supabase-access-token')
      .expect(200);

    expect(res.body).toMatchObject({ id: 'm1', threadId: 't1' });
    expect(res.body.bodyText).toBe('hello');
    expect(res.body.headers?.subject).toBe('Only one message');
  });
});
