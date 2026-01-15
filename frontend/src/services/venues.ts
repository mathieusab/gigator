import { supabase } from '../lib/supabaseClient';

export type Venue = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  address: string | null;
  postal_code: string | null;
  region: string | null;
  lat: string | number | null;
  lng: string | number | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  capacity: number | null;
  has_played: boolean;
  load_in_notes: string | null;
  parking_notes: string | null;
  hospitality_notes: string | null;
  tech_notes: string | null;
  merch_notes: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('Unexpected empty response');
  return result.data;
}

export async function listVenues(): Promise<Venue[]> {
  const res = await supabase.from('venues').select('*').order('name', { ascending: true });
  return unwrap<Venue[]>(res);
}

export async function getVenue(id: string): Promise<Venue> {
  const res = await supabase.from('venues').select('*').eq('id', id).single();
  return unwrap<Venue>(res);
}

export type VenueCreateInput = {
  name: string;
  city?: string | null;
  country?: string | null;
  address?: string | null;
  postal_code?: string | null;
  region?: string | null;
  lat?: number | null;
  lng?: number | null;
  website?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  capacity?: number | null;
  has_played?: boolean;
  load_in_notes?: string | null;
  parking_notes?: string | null;
  hospitality_notes?: string | null;
  tech_notes?: string | null;
  merch_notes?: string | null;
  notes?: string | null;
};

export type CreateVenueResult = {
  venue: Venue;
  existed: boolean;
};

export async function createVenueWithInfo(input: VenueCreateInput): Promise<CreateVenueResult> {
  const name = input.name.trim();
  const address = input.address?.trim() || null;
  const city = input.city?.trim() || null;
  const country = input.country?.trim() || null;

  // Best-effort uniqueness enforcement on the client side.
  // DB should also enforce this with UNIQUE indexes.
  if (address) {
    const existing = await supabase
      .from('venues')
      .select('*')
      .eq('name', name)
      .eq('address', address)
      .limit(1);
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data?.[0]) return { venue: existing.data[0] as Venue, existed: true };
  } else if (city && country) {
    const existing = await supabase
      .from('venues')
      .select('*')
      .eq('name', name)
      .eq('city', city)
      .eq('country', country)
      .limit(1);
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data?.[0]) return { venue: existing.data[0] as Venue, existed: true };
  }

  const payload: Record<string, unknown> = {
    ...input,
    name,
    address,
    city,
    country,
    updated_at: new Date().toISOString(),
  };

  const res = await supabase.from('venues').insert(payload).select('*').single();
  if (res.error) {
    const code = String((res.error as any).code ?? '');
    const message = String(res.error.message ?? '');

    // Unique violation: another client created it concurrently.
    if (code === '23505' || /duplicate key value violates unique constraint/i.test(message)) {
      if (address) {
        const existing = await supabase
          .from('venues')
          .select('*')
          .eq('name', name)
          .eq('address', address)
          .limit(1);
        if (existing.error) throw new Error(existing.error.message);
        if (existing.data?.[0]) return { venue: existing.data[0] as Venue, existed: true };
      }
      if (city && country) {
        const existing = await supabase
          .from('venues')
          .select('*')
          .eq('name', name)
          .eq('city', city)
          .eq('country', country)
          .limit(1);
        if (existing.error) throw new Error(existing.error.message);
        if (existing.data?.[0]) return { venue: existing.data[0] as Venue, existed: true };
      }
      throw new Error('Ce lieu existe déjà.');
    }

    throw new Error(res.error.message);
  }
  if (res.data === null) throw new Error('Unexpected empty response');
  return { venue: res.data as Venue, existed: false };
}

export async function createVenue(input: VenueCreateInput): Promise<Venue> {
  const result = await createVenueWithInfo(input);
  return result.venue;
}

export async function deleteVenue(id: string): Promise<void> {
  const res = await supabase.from('venues').delete().eq('id', id);
  if (res.error) {
    const code = String((res.error as any).code ?? '');
    const message = String(res.error.message ?? '');

    // Postgres foreign key violation.
    if (
      code === '23503' ||
      /foreign key/i.test(message) ||
      /violates foreign key constraint/i.test(message)
    ) {
      throw new Error(
        "Impossible de supprimer ce lieu car il est lié à d’autres données (concerts, contacts, etc.). Supprimez ou dissociez ces éléments puis réessayez.",
      );
    }

    // RLS / permission errors (common when policy forbids delete).
    if (code === '42501' || /permission denied/i.test(message) || /row level security/i.test(message)) {
      throw new Error("Vous n'avez pas les droits pour supprimer ce lieu.");
    }

    throw new Error(res.error.message);
  }
}
