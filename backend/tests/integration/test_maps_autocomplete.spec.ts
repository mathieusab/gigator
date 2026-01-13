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

function mockFetchOnce(response: { status: number; json: unknown }) {
  const fetchMock = vi.fn();
  fetchMock.mockImplementationOnce(async () => {
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      json: async () => response.json,
    } as any;
  });
  vi.stubGlobal('fetch', fetchMock as any);
  return fetchMock;
}

describe('GET /maps/autocomplete', () => {
  beforeEach(() => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-google-key';
  });

  test('returns suggestions (happy path)', async () => {
    mockFetchOnce({
      status: 200,
      json: {
        status: 'OK',
        predictions: [
          {
            description: 'Le Bikini, Ramonville-Saint-Agne, France',
            place_id: 'place-1',
            structured_formatting: {
              main_text: 'Le Bikini',
              secondary_text: 'Ramonville-Saint-Agne, France',
            },
          },
          {
            description: 'Le Bikini 2, Somewhere',
            place_id: 'place-2',
            structured_formatting: { main_text: 'Le Bikini 2', secondary_text: 'Somewhere' },
          },
        ],
      },
    });

    const app = createApp();
    const res = await request(app)
      .get('/maps/autocomplete')
      .query({ input: 'biki' })
      .set('Authorization', 'Bearer supabase-access-token')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({
      place_id: 'place-1',
      name: 'Le Bikini',
      secondary_text: 'Ramonville-Saint-Agne, France',
    });
  });

  test('returns empty list when zero results', async () => {
    mockFetchOnce({ status: 200, json: { status: 'ZERO_RESULTS', predictions: [] } });

    const app = createApp();
    const res = await request(app)
      .get('/maps/autocomplete')
      .query({ input: 'zzzzzzzzzz' })
      .set('Authorization', 'Bearer supabase-access-token')
      .expect(200);

    expect(res.body).toEqual([]);
  });

  test('400 when missing input', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/maps/autocomplete')
      .set('Authorization', 'Bearer supabase-access-token')
      .expect(400);
    expect(res.body).toMatchObject({ error: 'Missing required query param: input' });
  });
});
