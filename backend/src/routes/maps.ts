import type { Request, Response } from 'express';
import { Router } from 'express';

import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { getBearerTokenFromHeader, verifySupabaseAccessToken } from '../lib/supabaseJwt.js';

export const mapsRouter = Router();

class MapsProxyError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function requireEnv(name: string): string {
  const v = String(process.env[name] ?? '').trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function requireActiveAppUserId(req: Request): Promise<string> {
  const token = getBearerTokenFromHeader(req.header('authorization'));
  if (!token) throw new MapsProxyError(401, 'Missing Authorization Bearer token');

  const { userId } = await verifySupabaseAccessToken(token);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('app_users')
    .select('id,is_active')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.is_active) throw new MapsProxyError(403, 'Access denied');

  return userId;
}

type GeocodingAddressComponent = {
  long_name?: string;
  short_name?: string;
  types?: string[];
};

type GeocodingResult = {
  formatted_address?: string;
  place_id?: string;
  geometry?: {
    location?: { lat?: number; lng?: number };
  };
  address_components?: GeocodingAddressComponent[];
};

type GeocodingResponse = {
  status?: string;
  error_message?: string;
  results?: GeocodingResult[];
};

type PlacesAutocompletePrediction = {
  description?: string;
  place_id?: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
};

type PlacesAutocompleteResponse = {
  status?: string;
  error_message?: string;
  predictions?: PlacesAutocompletePrediction[];
};

function findComponent(
  components: GeocodingAddressComponent[] | undefined,
  type: string,
): GeocodingAddressComponent | null {
  const arr = Array.isArray(components) ? components : [];
  return arr.find((c) => Array.isArray(c.types) && c.types.includes(type)) ?? null;
}

function pickName(component: GeocodingAddressComponent | null): string {
  return String(component?.long_name ?? component?.short_name ?? '').trim();
}

function extractAddressFields(result: GeocodingResult) {
  const components = Array.isArray(result.address_components) ? result.address_components : [];
  const streetNumber = pickName(findComponent(components, 'street_number'));
  const route = pickName(findComponent(components, 'route'));
  const premise = pickName(findComponent(components, 'premise'));

  const addressLine = [streetNumber, route].filter(Boolean).join(' ').trim();
  const formatted = String(result.formatted_address ?? '').trim();

  const city =
    pickName(findComponent(components, 'locality')) ||
    pickName(findComponent(components, 'postal_town')) ||
    pickName(findComponent(components, 'administrative_area_level_3')) ||
    pickName(findComponent(components, 'administrative_area_level_2'));

  const region = pickName(findComponent(components, 'administrative_area_level_1'));
  const country = pickName(findComponent(components, 'country'));
  const postalCode = pickName(findComponent(components, 'postal_code'));

  const lat = result.geometry?.location?.lat;
  const lng = result.geometry?.location?.lng;

  return {
    place_id: String(result.place_id ?? '').trim() || null,
    formatted_address: formatted || null,
    address: (addressLine || premise || formatted || '').trim() || null,
    city: city || null,
    region: region || null,
    country: country || null,
    postal_code: postalCode || null,
    lat: typeof lat === 'number' && Number.isFinite(lat) ? lat : null,
    lng: typeof lng === 'number' && Number.isFinite(lng) ? lng : null,
  };
}

mapsRouter.get('/geocode', async (req: Request, res: Response) => {
  try {
    await requireActiveAppUserId(req);

    const query = String(req.query.query ?? '').trim();
    const placeId = String(req.query.placeId ?? '').trim();
    if (!query && !placeId) {
      return res.status(400).json({ error: 'Missing required query param: query (or placeId)' });
    }

    const apiKey = requireEnv('GOOGLE_MAPS_API_KEY');
    const language = String(req.query.language ?? 'fr').trim() || 'fr';
    const region = String(req.query.region ?? 'fr').trim() || 'fr';

    const qs = new URLSearchParams({ key: apiKey, language, region });
    if (placeId) {
      qs.set('place_id', placeId);
    } else {
      qs.set('address', query);
    }
    const url = `https://maps.googleapis.com/maps/api/geocode/json?${qs.toString()}`;

    const upstream = await fetch(url);
    const json = (await upstream.json().catch(() => ({}))) as GeocodingResponse;

    if (!upstream.ok) {
      return res
        .status(502)
        .json({ error: json.error_message ?? `Google Geocoding error (${upstream.status})` });
    }

    const status = String(json.status ?? '').trim();
    if (status === 'ZERO_RESULTS') {
      return res.status(404).json({ error: 'No results' });
    }
    if (status === 'INVALID_REQUEST') {
      return res.status(400).json({ error: json.error_message ?? 'Invalid request' });
    }
    if (status && status !== 'OK') {
      return res.status(502).json({ error: json.error_message ?? `Google status: ${status}` });
    }

    const first = Array.isArray(json.results) ? json.results[0] : null;
    if (!first) {
      return res.status(404).json({ error: 'No results' });
    }

    return res.json(extractAddressFields(first));
  } catch (e) {
    if (e instanceof MapsProxyError) return res.status(e.status).json({ error: e.message });
    return res
      .status(500)
      .json({ error: e instanceof Error ? e.message : 'Maps proxy error' });
  }
});

mapsRouter.get('/autocomplete', async (req: Request, res: Response) => {
  try {
    await requireActiveAppUserId(req);

    const input = String(req.query.input ?? '').trim();
    if (!input) {
      return res.status(400).json({ error: 'Missing required query param: input' });
    }

    const apiKey = requireEnv('GOOGLE_MAPS_API_KEY');
    const language = String(req.query.language ?? 'fr').trim() || 'fr';

    // Optional ISO 3166-1 alpha-2 to bias results (e.g. "fr").
    const country = String(req.query.country ?? '').trim();

    const qs = new URLSearchParams({
      input,
      key: apiKey,
      language,
      types: 'establishment',
    });
    if (country) qs.set('components', `country:${country}`);

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${qs.toString()}`;
    const upstream = await fetch(url);
    const json = (await upstream.json().catch(() => ({}))) as PlacesAutocompleteResponse;

    if (!upstream.ok) {
      return res
        .status(502)
        .json({ error: json.error_message ?? `Google Places error (${upstream.status})` });
    }

    const status = String(json.status ?? '').trim();
    if (status === 'ZERO_RESULTS') {
      return res.json([]);
    }
    if (status === 'INVALID_REQUEST') {
      return res.status(400).json({ error: json.error_message ?? 'Invalid request' });
    }
    if (status && status !== 'OK') {
      return res.status(502).json({ error: json.error_message ?? `Google status: ${status}` });
    }

    const predictions = Array.isArray(json.predictions) ? json.predictions : [];
    const items = predictions
      .map((p) => {
        const place_id = String(p.place_id ?? '').trim();
        const description = String(p.description ?? '').trim();
        const main_text = String(p.structured_formatting?.main_text ?? '').trim();
        const secondary_text = String(p.structured_formatting?.secondary_text ?? '').trim();
        if (!place_id) return null;
        return {
          place_id,
          name: main_text || description || null,
          secondary_text: secondary_text || null,
          description: description || null,
        };
      })
      .filter(Boolean)
      .slice(0, 8);

    return res.json(items);
  } catch (e) {
    if (e instanceof MapsProxyError) return res.status(e.status).json({ error: e.message });
    return res
      .status(500)
      .json({ error: e instanceof Error ? e.message : 'Maps proxy error' });
  }
});
