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
        "Impossible de supprimer ce contact car il est lié à d’autres données (concerts, salles, etc.). Supprimez ou dissociez ces éléments puis réessayez.",
      );
    }

    // RLS / permission errors.
    if (code === '42501' || /permission denied/i.test(message) || /row level security/i.test(message)) {
      throw new Error("Vous n'avez pas les droits pour supprimer ce contact.");
    }

    throw new Error(res.error.message);
  }
}
