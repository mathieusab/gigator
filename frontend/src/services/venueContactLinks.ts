import { supabase } from '../lib/supabaseClient';
import { CONTACT_RELATION_TYPES, type ContactRelationType } from '../lib/contactRelationTypes';
import type { Contact } from './contacts';
import type { Venue } from './venues';

export const VENUE_CONTACT_RELATION_TYPES = CONTACT_RELATION_TYPES;

export type VenueContactRelationType = ContactRelationType;

export type VenueContactLink = {
  id: string;
  venue_id: string;
  contact_id: string;
  relation_type: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type VenueContactLinkWithContact = VenueContactLink & {
  contact: Contact;
};

export type VenueContactLinkWithVenue = VenueContactLink & {
  venue: Venue;
};

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('Unexpected empty response');
  return result.data;
}

export async function listContactsForVenue(venueId: string): Promise<VenueContactLinkWithContact[]> {
  const res = await supabase
    .from('venue_contact_links')
    .select('*, contact:contacts(*)')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: true });

  return unwrap<VenueContactLinkWithContact[]>(res);
}

export async function listVenuesForContact(contactId: string): Promise<VenueContactLinkWithVenue[]> {
  const res = await supabase
    .from('venue_contact_links')
    .select('*, venue:venues(*)')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: true });

  return unwrap<VenueContactLinkWithVenue[]>(res);
}

export async function upsertVenueContactLink(input: {
  venue_id: string;
  contact_id: string;
  relation_type?: string | null;
  notes?: string | null;
}): Promise<VenueContactLink> {
  const payload: Record<string, unknown> = {
    venue_id: input.venue_id,
    contact_id: input.contact_id,
    relation_type: input.relation_type ?? null,
    notes: input.notes ?? null,
    updated_at: new Date().toISOString(),
  };

  const res = await supabase
    .from('venue_contact_links')
    .upsert(payload, { onConflict: 'venue_id,contact_id' })
    .select('*')
    .single();

  return unwrap<VenueContactLink>(res);
}

export async function deleteVenueContactLink(id: string): Promise<void> {
  const linkId = String(id ?? '').trim();
  if (!linkId) throw new Error('Missing venue_contact_link id');

  const res = await supabase.from('venue_contact_links').delete().eq('id', linkId);
  if (res.error) throw new Error(res.error.message);
}
