import { supabase } from '../lib/supabaseClient';

export type ConcertFinancialItemKind = 'income' | 'expense';

export const CONCERT_FINANCIAL_CATEGORIES = [
  'Cachet',
  'Billetterie',
  'Merch',
  'Parking',
  'Transport',
  'Hébergement',
] as const;

export type ConcertFinancialCategory = (typeof CONCERT_FINANCIAL_CATEGORIES)[number];

export type ConcertFinancialItem = {
  id: string;
  concert_id: string;
  kind: ConcertFinancialItemKind;
  label: ConcertFinancialCategory;
  amount_cents: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ConcertFinancialItemUpsertInput = {
  kind: ConcertFinancialItemKind;
  label: ConcertFinancialCategory;
  amount_cents: number;
};

function assertCategory(label: string): asserts label is ConcertFinancialCategory {
  if (!CONCERT_FINANCIAL_CATEGORIES.includes(label as ConcertFinancialCategory)) {
    throw new Error('Catégorie invalide.');
  }
}

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

export async function listConcertFinancialItems(): Promise<ConcertFinancialItem[]> {
  const res = await supabase
    .from('concert_financial_items')
    .select('*')
    .order('created_at', { ascending: true });
  return unwrap<ConcertFinancialItem[]>(res);
}

export async function listConcertFinancialItemsForConcert(
  concertId: string,
): Promise<ConcertFinancialItem[]> {
  const res = await supabase
    .from('concert_financial_items')
    .select('*')
    .eq('concert_id', concertId)
    .order('created_at', { ascending: true });
  return unwrap<ConcertFinancialItem[]>(res);
}

export async function createConcertFinancialItem(
  concertId: string,
  input: ConcertFinancialItemUpsertInput,
): Promise<ConcertFinancialItem> {
  const userId = await requireUserId();

  assertCategory(input.label);

  const payload: Record<string, unknown> = {
    concert_id: concertId,
    kind: input.kind,
    label: input.label,
    amount_cents: input.amount_cents,
    created_by: userId,
    updated_at: new Date().toISOString(),
  };

  const res = await supabase
    .from('concert_financial_items')
    .insert(payload)
    .select('*')
    .single();
  return unwrap<ConcertFinancialItem>(res);
}

export async function updateConcertFinancialItem(
  id: string,
  input: ConcertFinancialItemUpsertInput,
): Promise<ConcertFinancialItem> {
  assertCategory(input.label);

  const payload: Record<string, unknown> = {
    kind: input.kind,
    label: input.label,
    amount_cents: input.amount_cents,
    updated_at: new Date().toISOString(),
  };

  const res = await supabase
    .from('concert_financial_items')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  return unwrap<ConcertFinancialItem>(res);
}

export async function deleteConcertFinancialItem(id: string): Promise<void> {
  const res = await supabase.from('concert_financial_items').delete().eq('id', id);
  if (res.error) throw new Error(res.error.message);
}
