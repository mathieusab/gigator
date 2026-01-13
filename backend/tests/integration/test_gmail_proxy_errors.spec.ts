import request from 'supertest';
import { beforeEach, describe, expect, test, vi } from 'vitest';

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

describe('GET /gmail/threads (error handling)', () => {
  beforeEach(async () => {
    process.env.GMAIL_PROXY_CLIENT_ID = 'test-client-id';
    process.env.GMAIL_PROXY_CLIENT_SECRET = 'test-client-secret';
    process.env.GMAIL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32).toString('base64');

    const supabaseAdmin = await import('../../src/lib/supabaseAdmin');
    (supabaseAdmin as any).__setGmailConnection({
      refresh_token_ciphertext: 'cipher',
      refresh_token_iv: 'iv',
      refresh_token_tag: 'tag',
    });
  });

  test('401 when refresh token exchange fails (token expired/revoked)', async () => {
    mockFetchSequence([
      {
        status: 400,
        json: { error: 'invalid_grant' },
      },
    ]);

    const app = createApp();
    const res = await request(app)
      .get('/gmail/threads')
      .query({ email: 'contact@example.com' })
      .set('Authorization', 'Bearer supabase-access-token')
      .expect(401);

    expect(String(res.body?.error ?? '')).toMatch(/reconnect gmail/i);
  });

  test('401 when Gmail API denies access (missing permission)', async () => {
    mockFetchSequence([
      {
        status: 200,
        json: { access_token: 'gmail-access-token' },
      },
      {
        status: 403,
        json: { error: { message: 'insufficientPermissions' } },
      },
    ]);

    const app = createApp();
    const res = await request(app)
      .get('/gmail/threads')
      .query({ email: 'contact@example.com' })
      .set('Authorization', 'Bearer supabase-access-token')
      .expect(401);

    expect(String(res.body?.error ?? '')).toMatch(/unauthorized|re-authenticate/i);
  });
});
