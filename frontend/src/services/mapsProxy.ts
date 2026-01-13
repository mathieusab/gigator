export type GeocodedPlace = {
  place_id: string | null;
  formatted_address: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  postal_code: string | null;
  lat: number | null;
  lng: number | null;
};

export type PlaceSuggestion = {
  place_id: string;
  name: string | null;
  secondary_text: string | null;
  description: string | null;
};

export async function geocodePlace(params: {
  appAccessToken: string;
  query?: string;
  placeId?: string;
  language?: string;
  region?: string;
}): Promise<GeocodedPlace> {
  const query = String(params.query ?? '').trim();
  const placeId = String(params.placeId ?? '').trim();
  if (!query && !placeId) throw new Error('Missing query');

  const qs = new URLSearchParams();
  if (placeId) qs.set('placeId', placeId);
  else qs.set('query', query);
  if (params.language) qs.set('language', params.language);
  if (params.region) qs.set('region', params.region);

  const res = await fetch(`/maps/geocode?${qs.toString()}`, {
    headers: {
      Authorization: `Bearer ${params.appAccessToken}`,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as any;
    throw new Error(body?.error ?? `Maps proxy error (${res.status})`);
  }

  return (await res.json()) as GeocodedPlace;
}

export async function autocompletePlaces(params: {
  appAccessToken: string;
  input: string;
  language?: string;
  country?: string;
}): Promise<PlaceSuggestion[]> {
  const input = params.input.trim();
  if (!input) return [];

  const qs = new URLSearchParams({ input });
  if (params.language) qs.set('language', params.language);
  if (params.country) qs.set('country', params.country);

  const res = await fetch(`/maps/autocomplete?${qs.toString()}`, {
    headers: {
      Authorization: `Bearer ${params.appAccessToken}`,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as any;
    throw new Error(body?.error ?? `Maps proxy error (${res.status})`);
  }

  const json = (await res.json()) as unknown;
  return Array.isArray(json) ? (json as PlaceSuggestion[]) : [];
}
