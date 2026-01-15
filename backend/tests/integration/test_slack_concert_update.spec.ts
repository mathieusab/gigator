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
  return {
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
        throw new Error(`Unexpected table: ${table}`);
      },
    }),
  };
});

function stubSlackFetchOnce(status: number, text: string) {
  const fetchMock = vi.fn();
  fetchMock.mockImplementationOnce(async () => {
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => text,
    } as any;
  });
  vi.stubGlobal('fetch', fetchMock as any);
  return fetchMock;
}

describe('POST /slack/concert-update', () => {
  beforeEach(() => {
    delete process.env.SLACK_WEBHOOK_URL;
    delete process.env.SLACK_CHANNEL;
  });

  test('401 when missing Authorization token', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/slack/concert-update')
      .send({ action: 'created', concert: { id: 'c-1', venue_name: 'Le Bikini' } })
      .expect(401);

    expect(res.body).toMatchObject({ error: 'Missing Authorization Bearer token' });
  });

  test('400 when action is invalid', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/slack/concert-update')
      .set('Authorization', 'Bearer supabase-access-token')
      .send({ action: 'nope', concert: { id: 'c-1' } })
      .expect(400);

    expect(res.body).toMatchObject({ error: 'Invalid action' });
  });

  test('204 and skips when SLACK_WEBHOOK_URL missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock as any);

    const app = createApp();
    await request(app)
      .post('/slack/concert-update')
      .set('Authorization', 'Bearer supabase-access-token')
      .send({ action: 'created', concert: { id: 'c-1', venue_name: 'Le Bikini' } })
      .expect(204);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('204 and posts to Slack when configured', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.test/services/T000/B000/XXX';
    const fetchMock = stubSlackFetchOnce(200, 'ok');

    const app = createApp();
    await request(app)
      .post('/slack/concert-update')
      .set('Authorization', 'Bearer supabase-access-token')
      .send({
        action: 'updated',
        concert: {
          id: 'c-1',
          venue_name: 'Le Bikini',
          city: 'Toulouse',
          date_start: '2026-01-15T20:00:00.000Z',
          status: 'scheduled',
        },
      })
      .expect(204);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as any[];
    expect(String(url)).toContain('hooks.slack.test');
    expect(init?.method).toBe('POST');
    const body = JSON.parse(String(init?.body ?? '{}'));
    expect(String(body.text)).toMatch(/Concert modifié/i);
    expect(String(body.text)).toMatch(/Le Bikini/i);
  });
});
