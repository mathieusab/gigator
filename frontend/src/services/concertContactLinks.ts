import { supabase } from '../lib/supabaseClient';
import type { Contact } from './contacts';

export type ConcertContactLink = {
  id: string;
  concert_id: string;
  contact_id: string;
  created_at: string;
  updated_at: string;
};

export type ConcertContactLinkWithContact = ConcertContactLink & {
  contact: Contact;
};

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('Unexpected empty response');
  return result.data;
}

export async function listContactsForConcert(concertId: string): Promise<ConcertContactLinkWithContact[]> {
  const res = await supabase
    .from('concert_contact_links')
    .select('*, contact:contacts(*)')
    .eq('concert_id', concertId)
    .order('created_at', { ascending: true });

  return unwrap<ConcertContactLinkWithContact[]>(res);
}

export async function replaceContactsForConcert(concertId: string, contactIds: string[]): Promise<void> {
  const uniqueIds = Array.from(new Set(contactIds.map((x) => String(x).trim()).filter(Boolean)));

  const del = await supabase.from('concert_contact_links').delete().eq('concert_id', concertId);
  if (del.error) throw new Error(del.error.message);

  if (!uniqueIds.length) return;

  const payload = uniqueIds.map((contactId) => ({
    concert_id: concertId,
    contact_id: contactId,
    updated_at: new Date().toISOString(),
  }));

  const ins = await supabase.from('concert_contact_links').insert(payload);
  if (ins.error) throw new Error(ins.error.message);
}
