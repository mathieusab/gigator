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

export async function createVenue(input: VenueCreateInput): Promise<Venue> {
  const payload: Record<string, unknown> = {
    ...input,
    name: input.name.trim(),
    updated_at: new Date().toISOString(),
  };

  const res = await supabase.from('venues').insert(payload).select('*').single();
  return unwrap<Venue>(res);
}
