import { supabase } from '../lib/supabaseClient';

export type GmailTodoThreadStatus = 'open' | 'done' | 'ignored';

export type GmailTodoThread = {
  id: string;
  app_user_id: string;
  gmail_email: string;
  thread_id: string;
  counterpart_email: string;
  subject: string | null;
  snippet: string | null;
  last_message_at: string | null;
  status: GmailTodoThreadStatus;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('Unexpected empty response');
  return result.data;
}

export async function listOpenGmailTodoThreads(params: {
  limit?: number;
} = {}): Promise<GmailTodoThread[]> {
  const limit = typeof params.limit === 'number' && Number.isFinite(params.limit) ? params.limit : 50;

  const res = await supabase
    .from('gmail_todo_threads')
    .select('*')
    .eq('status', 'open')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(Math.max(1, Math.min(200, Math.floor(limit))));

  return unwrap<GmailTodoThread[]>(res);
}

export async function upsertGmailTodoThreads(params: {
  appUserId: string;
  gmailEmail: string;
  threads: Array<{
    threadId: string;
    counterpartEmail: string;
    subject?: string;
    snippet?: string;
    lastMessageAt?: string | null;
  }>;
}): Promise<GmailTodoThread[]> {
  const appUserId = params.appUserId.trim();
  const gmailEmail = params.gmailEmail.trim();
  if (!appUserId) throw new Error('Missing appUserId');
  if (!gmailEmail) throw new Error('Missing gmailEmail');

  const now = new Date().toISOString();

  const rows = params.threads
    .map((t) => ({
      app_user_id: appUserId,
      gmail_email: gmailEmail,
      thread_id: String(t.threadId ?? '').trim(),
      counterpart_email: String(t.counterpartEmail ?? '').trim().toLowerCase(),
      subject: t.subject ? String(t.subject).trim() : null,
      snippet: t.snippet ? String(t.snippet).trim() : null,
      last_message_at: t.lastMessageAt ?? null,
      last_seen_at: now,
      updated_at: now,
    }))
    .filter((r) => r.thread_id && r.counterpart_email);

  if (rows.length === 0) return [];

  const res = await supabase
    .from('gmail_todo_threads')
    .upsert(rows, { onConflict: 'app_user_id,gmail_email,thread_id' })
    .select('*');

  if (res.error) throw new Error(res.error.message);
  return unwrap<GmailTodoThread[]>(res);
}

export async function updateGmailTodoThreadStatus(params: {
  id: string;
  status: GmailTodoThreadStatus;
}): Promise<void> {
  const id = params.id.trim();
  if (!id) throw new Error('Missing id');
  const now = new Date().toISOString();

  const res = await supabase
    .from('gmail_todo_threads')
    .update({ status: params.status, updated_at: now })
    .eq('id', id);

  if (res.error) throw new Error(res.error.message);
}
