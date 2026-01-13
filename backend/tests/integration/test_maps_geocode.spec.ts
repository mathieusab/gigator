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

describe('GET /maps/geocode', () => {
  beforeEach(() => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-google-key';
  });

  test('returns parsed address fields (happy path)', async () => {
    mockFetchOnce({
      status: 200,
      json: {
        status: 'OK',
        results: [
          {
            formatted_address: '8 Rue de la Paix, 75002 Paris, France',
            place_id: 'place-123',
            geometry: { location: { lat: 48.8698, lng: 2.3316 } },
            address_components: [
              { long_name: '8', short_name: '8', types: ['street_number'] },
              { long_name: 'Rue de la Paix', short_name: 'Rue de la Paix', types: ['route'] },
              { long_name: 'Paris', short_name: 'Paris', types: ['locality'] },
              {
                long_name: 'Île-de-France',
                short_name: 'IDF',
                types: ['administrative_area_level_1'],
              },
              { long_name: '75002', short_name: '75002', types: ['postal_code'] },
              { long_name: 'France', short_name: 'FR', types: ['country'] },
            ],
          },
        ],
      },
    });

    const app = createApp();
    const res = await request(app)
      .get('/maps/geocode')
      .query({ query: 'Rue de la Paix Paris' })
      .set('Authorization', 'Bearer supabase-access-token')
      .expect(200);

    expect(res.body).toMatchObject({
      place_id: 'place-123',
      city: 'Paris',
      region: 'Île-de-France',
      country: 'France',
      postal_code: '75002',
      lat: 48.8698,
      lng: 2.3316,
    });
    expect(String(res.body.address)).toContain('Rue de la Paix');
  });

  test('404 when no results', async () => {
    mockFetchOnce({ status: 200, json: { status: 'ZERO_RESULTS', results: [] } });

    const app = createApp();
    const res = await request(app)
      .get('/maps/geocode')
      .query({ query: 'zzzzzzzzzz' })
      .set('Authorization', 'Bearer supabase-access-token')
      .expect(404);

    expect(res.body).toMatchObject({ error: 'No results' });
  });

  test('supports geocoding by placeId (from autocomplete)', async () => {
    mockFetchOnce({
      status: 200,
      json: {
        status: 'OK',
        results: [
          {
            formatted_address: 'Le Bikini, 31000 Toulouse, France',
            place_id: 'place-abc',
            geometry: { location: { lat: 43.6043, lng: 1.4437 } },
            address_components: [
              { long_name: 'Toulouse', short_name: 'Toulouse', types: ['locality'] },
              {
                long_name: 'Occitanie',
                short_name: 'Occitanie',
                types: ['administrative_area_level_1'],
              },
              { long_name: 'France', short_name: 'FR', types: ['country'] },
            ],
          },
        ],
      },
    });

    const app = createApp();
    const res = await request(app)
      .get('/maps/geocode')
      .query({ placeId: 'place-abc' })
      .set('Authorization', 'Bearer supabase-access-token')
      .expect(200);

    expect(res.body).toMatchObject({
      place_id: 'place-abc',
      city: 'Toulouse',
      region: 'Occitanie',
      country: 'France',
      lat: 43.6043,
      lng: 1.4437,
    });
  });

  test('401 when missing Authorization token', async () => {
    const app = createApp();
    const res = await request(app).get('/maps/geocode').query({ query: 'Paris' }).expect(401);
    expect(res.body).toMatchObject({ error: 'Missing Authorization Bearer token' });
  });

  test('500 when Google key is missing', async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;

    const app = createApp();
    const res = await request(app)
      .get('/maps/geocode')
      .query({ query: 'Paris' })
      .set('Authorization', 'Bearer supabase-access-token')
      .expect(500);

    expect(String(res.body?.error ?? '')).toMatch(/missing google_maps_api_key/i);
  });
});
