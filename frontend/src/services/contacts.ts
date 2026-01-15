import { supabase } from '../lib/supabaseClient';

export type Contact = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  last_contact_at: string | null;
  role: string | null;
  organization: string | null;
  preferred_language: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('Unexpected empty response');
  return result.data;
}

export async function listContacts(): Promise<Contact[]> {
  const res = await supabase.from('contacts').select('*').order('full_name', { ascending: true });
  return unwrap<Contact[]>(res);
}

export async function getContact(id: string): Promise<Contact> {
  const res = await supabase.from('contacts').select('*').eq('id', id).single();
  return unwrap<Contact>(res);
}

export type ContactCreateInput = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  last_contact_at?: string | null;
  role?: string | null;
  organization?: string | null;
  preferred_language?: string | null;
  notes?: string | null;
};

export type CreateContactResult = {
  contact: Contact;
  existed: boolean;
};

export async function createContactWithInfo(input: ContactCreateInput): Promise<CreateContactResult> {
  const full_name = input.full_name?.trim() || null;
  const email = input.email?.trim() || null;
  const phone = input.phone?.trim() || null;

  // Best-effort uniqueness enforcement on the client side.
  // DB should also enforce this with UNIQUE indexes, but this avoids accidental duplicates
  // when the DB isn't constrained yet.
  if (email) {
    const existing = await supabase.from('contacts').select('*').ilike('email', email).limit(1);
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data?.[0]) return { contact: existing.data[0] as Contact, existed: true };
  }

  if (phone) {
    const existing = await supabase.from('contacts').select('*').eq('phone', phone).limit(1);
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data?.[0]) return { contact: existing.data[0] as Contact, existed: true };
  }

  const payload: Record<string, unknown> = {
    ...input,
    full_name,
    email,
    phone,
    updated_at: new Date().toISOString(),
  };

  const res = await supabase.from('contacts').insert(payload).select('*').single();
  if (res.error) {
    const code = String((res.error as any).code ?? '');
    const message = String(res.error.message ?? '');

    // Unique violation: another client created it concurrently.
    if (code === '23505' || /duplicate key value violates unique constraint/i.test(message)) {
      if (email) {
        const existing = await supabase.from('contacts').select('*').ilike('email', email).limit(1);
        if (existing.error) throw new Error(existing.error.message);
        if (existing.data?.[0]) return { contact: existing.data[0] as Contact, existed: true };
      }
      if (phone) {
        const existing = await supabase.from('contacts').select('*').eq('phone', phone).limit(1);
        if (existing.error) throw new Error(existing.error.message);
        if (existing.data?.[0]) return { contact: existing.data[0] as Contact, existed: true };
      }
      throw new Error('Ce contact existe déjà.');
    }

    throw new Error(res.error.message);
  }
  if (res.data === null) throw new Error('Unexpected empty response');
  return { contact: res.data as Contact, existed: false };
}

export async function createContact(input: ContactCreateInput): Promise<Contact> {
  const result = await createContactWithInfo(input);
  return result.contact;
}

export async function deleteContact(id: string): Promise<void> {
  const res = await supabase.from('contacts').delete().eq('id', id);
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
        "Impossible de supprimer ce contact car il est lié à d’autres données (concerts, lieux, etc.). Supprimez ou dissociez ces éléments puis réessayez.",
      );
    }

    // RLS / permission errors.
    if (code === '42501' || /permission denied/i.test(message) || /row level security/i.test(message)) {
      throw new Error("Vous n'avez pas les droits pour supprimer ce contact.");
    }

    throw new Error(res.error.message);
  }
}
