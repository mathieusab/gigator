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

export async function createContact(input: ContactCreateInput): Promise<Contact> {
  const payload: Record<string, unknown> = {
    ...input,
    full_name: input.full_name?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const res = await supabase.from('contacts').insert(payload).select('*').single();
  return unwrap<Contact>(res);
}
