import { supabase } from '../lib/supabaseClient';
import { CONTACT_RELATION_TYPES, type ContactRelationType } from '../lib/contactRelationTypes';
import type { Contact } from './contacts';

export const CONCERT_CONTACT_CATEGORIES = CONTACT_RELATION_TYPES;

export type ConcertContactCategory = ContactRelationType;

export type ConcertContactLinkInput = {
  contact_id: string;
  category?: ConcertContactCategory | null;
};

export type ConcertContactLink = {
  id: string;
  concert_id: string;
  contact_id: string;
  category: ConcertContactCategory | null;
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

export async function replaceContactsForConcert(
  concertId: string,
  links: ConcertContactLinkInput[],
): Promise<void> {
  const normalized = links
    .map((l) => ({
      contact_id: String(l.contact_id).trim(),
      category: (l.category ?? null) as ConcertContactCategory | null,
    }))
    .filter((l) => Boolean(l.contact_id));

  const seen = new Set<string>();
  const unique = normalized.filter((l) => {
    if (seen.has(l.contact_id)) return false;
    seen.add(l.contact_id);
    return true;
  });

  const del = await supabase.from('concert_contact_links').delete().eq('concert_id', concertId);
  if (del.error) throw new Error(del.error.message);

  if (!unique.length) return;

  const payload = unique.map((l) => ({
    concert_id: concertId,
    contact_id: l.contact_id,
    category: l.category,
    updated_at: new Date().toISOString(),
  }));

  const ins = await supabase.from('concert_contact_links').insert(payload);
  if (ins.error) throw new Error(ins.error.message);
}
