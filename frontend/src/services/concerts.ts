import { supabase } from '../lib/supabaseClient';

export type ConcertStatus = 'scheduled' | 'completed' | 'cancelled';

export type Concert = {
  id: string;
  date_start: string;
  date_end: string | null;
  status: ConcertStatus;
  title: string;
  venue_id: string | null;
  contact_id: string | null;
  venue_name: string;
  city: string | null;
  country: string | null;
  address: string | null;
  lat: string | number | null;
  lng: string | number | null;
  venue_contact_name: string | null;
  venue_contact_email: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ConcertUpsertInput = {
  date_start: string;
  date_end?: string | null;
  status?: ConcertStatus;
  title?: string;
  venue_id?: string | null;
  contact_id?: string | null;
  venue_name: string;
  city?: string | null;
  country?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  venue_contact_name?: string | null;
  venue_contact_email?: string | null;
  notes?: string | null;
};

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  const userId = data.user?.id;
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('Unexpected empty response');
  return result.data;
}

function deriveTitle(input: ConcertUpsertInput): string {
  if (input.title && input.title.trim()) return input.title.trim();
  const venue = input.venue_name.trim();
  const city = input.city?.trim();
  return city ? `${venue} — ${city}` : venue;
}

export async function listConcerts(): Promise<Concert[]> {
  const res = await supabase.from('concerts').select('*').order('date_start', { ascending: true });
  return unwrap<Concert[]>(res);
}

export async function getConcert(id: string): Promise<Concert> {
  const res = await supabase.from('concerts').select('*').eq('id', id).single();
  return unwrap<Concert>(res);
}

export async function createConcert(input: ConcertUpsertInput): Promise<Concert> {
  const userId = await requireUserId();

  const payload: Record<string, unknown> = {
    ...input,
    created_by: userId,
    title: deriveTitle(input),
    status: input.status ?? 'scheduled',
    venue_id: 'venue_id' in input ? input.venue_id ?? null : null,
    contact_id: 'contact_id' in input ? input.contact_id ?? null : null,
    updated_at: new Date().toISOString(),
  };

  if ('date_end' in input) {
    payload.date_end = input.date_end ?? null;
  }

  const res = await supabase.from('concerts').insert(payload).select('*').single();
  return unwrap<Concert>(res);
}

export async function updateConcert(id: string, input: ConcertUpsertInput): Promise<Concert> {
  const payload: Record<string, unknown> = {
    ...input,
    title: deriveTitle(input),
    status: input.status ?? 'scheduled',
    venue_id: 'venue_id' in input ? input.venue_id ?? null : null,
    contact_id: 'contact_id' in input ? input.contact_id ?? null : null,
    updated_at: new Date().toISOString(),
  };

  if ('date_end' in input) {
    payload.date_end = input.date_end ?? null;
  }

  const res = await supabase.from('concerts').update(payload).eq('id', id).select('*').single();
  return unwrap<Concert>(res);
}

export async function deleteConcert(id: string): Promise<void> {
  const res = await supabase.from('concerts').delete().eq('id', id);
  if (res.error) throw new Error(res.error.message);
}
