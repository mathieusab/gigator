// app/backend/services/gmail_import.ts
// Gmail import PoC service (TypeScript)
//
// Responsibilities (PoC):
// - Given a linked gmail_accounts.id, fetch recent threads from Gmail using the stored access token.
// - Persist threads into `threads` and messages into `messages` (upsert behavior).
// - Refresh access_token with refresh_token if expired (basic handling).
//
// IMPORTANT NOTES (PoC):
// - This code is intentionally minimal for a PoC. In production:
//   - Encrypt refresh_token at rest.
//   - Add robust retries, exponential backoff and rate-limit handling.
//   - Respect least-privilege scopes and request only what's needed (gmail.readonly).
//   - Validate and store message parts/attachments properly (here we store a snippet/body).
//   - Protect endpoints and verify account ownership before importing.
//
// Environment expectations:
// - DATABASE_URL
// - GOOGLE_CLIENT_ID
// - GOOGLE_CLIENT_SECRET
//
// Usage:
// - Call importThreadsForAccount(accountId, { maxResults: 50 }) from a job/route after OAuth flow.
// - The OAuth controller created earlier writes gmail_accounts with access/refresh tokens:
//   see [`db/migrations/0001_create_gmail_tokens.sql`](db/migrations/0001_create_gmail_tokens.sql:1)
// - Routes: [`app/backend/routes/auth_google.ts`](app/backend/routes/auth_google.ts:1)
// - Controller helpers: [`app/backend/controllers/oauth.ts`](app/backend/controllers/oauth.ts:1)

import { Pool } from 'pg';

const {
  DATABASE_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET
} = process.env;

if (!DATABASE_URL) {
  // For PoC we won't throw at import time; callers will see DB connection errors.
}

const pool = new Pool({
  connectionString: DATABASE_URL
});

type GmailThread = any;
type GmailMessage = any;

function redactTokensInString(s: string): string {
  // Defensive: never allow refresh_token / id_token to appear in logs.
  return s
    .replace(/("refresh_token"\s*:\s*")([^"]+)(")/gi, '$1[REDACTED]$3')
    .replace(/("id_token"\s*:\s*")([^"]+)(")/gi, '$1[REDACTED]$3')
    .replace(/\b(refresh_token|id_token)\s*=\s*([^\s&]+)/gi, '$1=[REDACTED]')
    .replace(/\b(refresh_token|id_token)\b\s*:\s*([^\s,}]+)/gi, '$1: [REDACTED]');
}

function sanitizeErrorForLog(err: unknown): unknown {
  if (err instanceof Error) {
    const safeMessage = redactTokensInString(err.message || '');
    const safeStack = err.stack ? redactTokensInString(err.stack) : undefined;
    return { name: err.name, message: safeMessage, stack: safeStack };
  }
  if (typeof err === 'string') return redactTokensInString(err);
  try {
    const asJson = JSON.stringify(err);
    return JSON.parse(redactTokensInString(asJson));
  } catch {
    return '[unserializable_error]';
  }
}

async function refreshAccessTokenIfNeeded(account: any) {
  // account: row from gmail_accounts
  if (!account) throw new Error('account required');

  const now = new Date();
  if (account.expires_at && new Date(account.expires_at) > now) {
    // still valid
    return account.access_token;
  }

  if (!account.refresh_token) {
    throw new Error('no_refresh_token_available');
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not configured');
  }

  // Exchange refresh_token for a new access_token
  const tokenUrl = 'https://oauth2.googleapis.com/token';
  const body = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: account.refresh_token,
    grant_type: 'refresh_token'
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!res.ok) {
    // Do not include provider response body in thrown errors: it may contain sensitive details.
    throw new Error(`refresh_token_failed: ${res.status}`);
  }

  // `Response.json()` is typed as `unknown` under strict TS; cast to minimal expected shape.
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  const access_token = json.access_token;
  const expires_in = json.expires_in;

  // Persist updated access token & expiry
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE gmail_accounts SET access_token = $1, expires_at = (now() + ($2 || ' seconds')::interval), updated_at = now() WHERE id = $3`,
      [access_token, String(expires_in || 3600), account.id]
    );
  } finally {
    client.release();
  }

  return access_token;
}

async function fetchGmailThreadsList(accessToken: string, maxResults = 50): Promise<string[]> {
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/threads');
  url.searchParams.set('maxResults', String(maxResults));
  // Could set q param for filtering (e.g., newer_than)
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    // Avoid propagating provider response bodies into logs/errors.
    throw new Error(`failed_list_threads: ${res.status}`);
  }

  // `Response.json()` is typed as `unknown` under strict TS; cast to minimal expected shape.
  const json = (await res.json()) as { threads?: Array<{ id?: string }> };
  const threads = json.threads || [];
  return threads.map((t) => t.id).filter((id): id is string => typeof id === 'string');
}

async function fetchGmailThread(accessToken: string, threadId: string): Promise<GmailThread> {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}`);
  // format=full to get messages and payload
  url.searchParams.set('format', 'full');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    // Avoid propagating provider response bodies into logs/errors.
    throw new Error(`failed_fetch_thread ${threadId}: ${res.status}`);
  }

  const json = await res.json();
  return json;
}

async function upsertThreadAndMessages(threadResource: GmailThread) {
  // threadResource: the API object returned by Gmail threads.get
  // We'll upsert threads by gmail_thread_id and insert messages if message_id not present.
  const gmailThreadId = threadResource.id;
  const messages: GmailMessage[] = threadResource.messages || [];
  const subjectHeader =
    (messages[0]?.payload?.headers || []).find((h: any) => h.name.toLowerCase() === 'subject')?.value || null;

  const lastMessageAt =
    (messages
      .map((m: any) => m.internalDate ? new Date(Number(m.internalDate)) : null)
      .filter(Boolean)
      .sort((a: any, b: any) => (b as any) - (a as any))[0]) || null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Upsert thread
    const upsertThreadSql = `
      INSERT INTO threads (gmail_thread_id, subject, last_message_at, raw_payload)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (gmail_thread_id)
      DO UPDATE SET subject = EXCLUDED.subject, last_message_at = EXCLUDED.last_message_at, raw_payload = EXCLUDED.raw_payload, updated_at = now()
      RETURNING id;
    `;

    const threadRes = await client.query(upsertThreadSql, [
      gmailThreadId,
      subjectHeader,
      lastMessageAt,
      threadResource
    ]);

    const threadId = threadRes.rows[0].id;

    // Insert messages (skip if message_id already exists)
    for (const m of messages) {
      const messageId = m.id || null;
      // Simple body extraction: use snippet or first text/plain part if available
      let body = m.snippet || null;

      // Try to extract text/plain from payload parts (simple search)
      try {
        const payload = m.payload;
        if (payload) {
          const walk = (p: any): string | null => {
            if (!p) return null;
            if (p.mimeType === 'text/plain' && p.body && p.body.data) {
              // body.data is base64url encoded
              try {
                const buf = Buffer.from(p.body.data, 'base64');
                return buf.toString('utf8');
              } catch (e) {
                return null;
              }
            }
            if (p.parts && Array.isArray(p.parts)) {
              for (const part of p.parts) {
                const found = walk(part);
                if (found) return found;
              }
            }
            return null;
          };
          const extracted = walk(payload);
          if (extracted) body = extracted;
        }
      } catch (e) {
        // ignore extraction errors for PoC
      }

      // Avoid duplicate message insertion by message_id
      const existsRes = await client.query('SELECT 1 FROM messages WHERE message_id = $1 LIMIT 1', [messageId]);
      if ((existsRes.rowCount ?? 0) > 0) {
        continue;
      }

      const insertMsgSql = `
        INSERT INTO messages (thread_id, sender_id, direction, message_id, subject, body, raw_payload, sent_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8::double precision / 1000))
      `;
      // We don't map sender_id here (profiles). Leave as NULL in PoC.
      const sentAtMs = m.internalDate ? Number(m.internalDate) : null;
      await client.query(insertMsgSql, [
        threadId,
        null,
        'inbound',
        messageId,
        subjectHeader,
        body,
        m,
        sentAtMs
      ]);
    }

    await client.query('COMMIT');
    return { threadId, messageCount: messages.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Public function: import threads for a linked gmail account (accountId is gmail_accounts.id)
export async function importThreadsForAccount(accountId: string, opts?: { maxResults?: number }) {
  const maxResults = opts?.maxResults ?? 50;

  const client = await pool.connect();
  try {
    // Load account record
    const accRes = await client.query('SELECT * FROM gmail_accounts WHERE id = $1', [accountId]);
    if (accRes.rowCount === 0) throw new Error('account_not_found');
    let account = accRes.rows[0];

    // Ensure we have a valid access token (refresh if needed)
    const accessToken = await refreshAccessTokenIfNeeded(account);

    // Fetch thread ids list
    const threadIds = await fetchGmailThreadsList(accessToken, maxResults);

    let imported = 0;
    for (const tid of threadIds) {
      try {
        const threadRes = await fetchGmailThread(accessToken, tid);
        await upsertThreadAndMessages(threadRes);
        imported += 1;
      } catch (err) {
        // For PoC, log and continue (sanitize defensively to avoid leaking tokens).
        // eslint-disable-next-line no-console
        console.error('failed import thread', tid, sanitizeErrorForLog(err));
      }
    }

    // Mark import run as completed (insert a run record)
    await client.query(
      `INSERT INTO gmail_import_runs (account_id, status, details) VALUES ($1, $2, $3)`,
      [accountId, 'completed', { imported }]
    );

    return { imported, attempted: threadIds.length };
  } finally {
    client.release();
  }
}

// Export helper to be used by job/route
export default {
  importThreadsForAccount
};