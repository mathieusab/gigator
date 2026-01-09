// app/backend/controllers/oauth.ts
// Controller helpers for Gmail OAuth PoC.
//
// Exports:
// - getAuthUrl(): Promise<string>            -> build Google OAuth consent URL
// - handleOAuthCallback(code, state, userId) -> exchange code, persist account, return sanitized account
// - listLinkedAccounts(userId?)              -> list gmail_accounts rows (PoC)
//
// Expectations:
// - Environment variables:
//   - GOOGLE_CLIENT_ID
//   - GOOGLE_CLIENT_SECRET
//   - GOOGLE_OAUTH_REDIRECT_URI
//   - DATABASE_URL
//
// Dependencies:
// - Uses global fetch (Node 18+). Uses 'pg' for DB access. Install: `npm install pg` and types for TS if needed.
//
// Notes:
// - This is PoC code. In production: encrypt refresh_token at rest, validate state, protect endpoints with auth,
//   handle token rotation and revocation webhooks, and restrict scopes to least-privilege (gmail.readonly for imports).

import { Pool } from 'pg';
import crypto from 'crypto';
import { deleteOauthState, getOauthState, persistOauthState } from '../lib/oauth_state_store';

class OAuthConfigError extends Error {
  code = 'OAUTH_CONFIG_ERROR' as const;
  constructor(message: string) {
    super(message);
    this.name = 'OAuthConfigError';
  }
}

export function isOAuthConfigError(err: unknown): err is OAuthConfigError {
  return (
    !!err &&
    typeof err === 'object' &&
    (err as any).code === 'OAUTH_CONFIG_ERROR' &&
    (err as any).name === 'OAuthConfigError'
  );
}

function getEnvSnapshot() {
  return {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_OAUTH_REDIRECT_URI: process.env.GOOGLE_OAUTH_REDIRECT_URI,
    DATABASE_URL: process.env.DATABASE_URL
  };
}

let pool: Pool | null = null;

/**
 * Lazily initialize the DB pool to avoid module-load side effects for routes that don't need DB
 * (e.g. [`POST /api/sync/gmail/start`](app/backend/routes/auth_google.ts:50)).
 */
function getPool(): Pool {
  if (!pool) {
    const { DATABASE_URL } = getEnvSnapshot();
    pool = new Pool({ connectionString: DATABASE_URL });
  }
  return pool;
}

type GetAuthUrlObjectResult = { oauth_url: string; state: string };

type GetAuthUrlOptions = {
  /**
   * When true, returns `{ oauth_url, state }` (useful for tests / future session binding).
   * Default: false (returns string URL only)
   */
  returnObject?: boolean;
  /** Optional metadata to persist alongside the state */
  stateMeta?: Record<string, unknown>;
  /** Optional TTL override (seconds). Falls back to store default if omitted. */
  ttlSeconds?: number;
};

// Build the authorization URL (string by default, optional object result)
export async function getAuthUrl(): Promise<string>;
export async function getAuthUrl(options: { returnObject: true } & Omit<GetAuthUrlOptions, 'returnObject'>): Promise<GetAuthUrlObjectResult>;
export async function getAuthUrl(options?: GetAuthUrlOptions): Promise<string | GetAuthUrlObjectResult> {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI } = getEnvSnapshot();

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_OAUTH_REDIRECT_URI) {
    throw new OAuthConfigError(
      'OAuth configuration missing or incomplete (requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI)'
    );
  }

  // For PoC use readonly Gmail scope + basic profile info
  const scopes = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/gmail.readonly'
  ];

  // State should be used to tie the request to a user/session.
  // Generate a cryptographically secure state and persist it with TTL.
  const state = crypto.randomBytes(24).toString('hex'); // 24 bytes -> strong entropy

  // Persist the state (Redis preferred, in-memory fallback).
  // If persistence fails, we fail closed because callback validation would be impossible.
  await persistOauthState(
    state,
    { created_at: new Date().toISOString(), ...(options?.stateMeta || {}) },
    options?.ttlSeconds
  );

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_OAUTH_REDIRECT_URI,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline', // request refresh_token
    include_granted_scopes: 'true',
    prompt: 'consent', // always ask so we get refresh_token on first consent
    state
  });

  const oauth_url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  if (options?.returnObject) {
    return { oauth_url, state };
  }
  return oauth_url;
}

// Exchange authorization code for tokens, fetch userinfo, and persist into DB.
export async function handleOAuthCallback(code: string, state?: string, profileId?: string) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI } = getEnvSnapshot();

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_OAUTH_REDIRECT_URI) {
    throw new OAuthConfigError(
      'OAuth configuration missing or incomplete (requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI)'
    );
  }

  // Validate and consume the oauth state (CSRF protection).
  // We fail closed: if state is missing/expired/unknown, reject.
  if (!state || typeof state !== 'string') {
    throw new Error('invalid_oauth_state');
  }
  const stateMeta = await getOauthState(state);
  if (!stateMeta) {
    throw new Error('invalid_oauth_state');
  }
  // One-time use: delete as early as possible to reduce replay window.
  await deleteOauthState(state);

  // Exchange code
  const TOKEN_URL = process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
  const body = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: GOOGLE_OAUTH_REDIRECT_URI,
    grant_type: 'authorization_code'
  });
 
  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
 
  if (!tokenRes.ok) {
    // Do not include provider response body in thrown errors: it may contain sensitive details.
    throw new Error(`token exchange failed: ${tokenRes.status}`);
  }

  const tokenJson = await tokenRes.json();
  const {
    access_token,
    expires_in,
    refresh_token,
    scope,
    token_type,
    id_token
  } = tokenJson as any;

  // Get userinfo
  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` }
  });

  if (!userInfoRes.ok) {
    // Do not include provider response body in thrown errors: it may contain sensitive details.
    throw new Error(`failed to fetch userinfo: ${userInfoRes.status}`);
  }

  // `Response.json()` is typed as `unknown` under strict TS; cast to a minimal expected shape.
  const userInfo = (await userInfoRes.json()) as {
    sub?: string;
    email?: string;
    name?: string;
  };

  const googleUserId = userInfo.sub;
  const email = userInfo.email;
  const displayName = userInfo.name || null;

  // Persist to DB (upsert by google_user_id). For PoC, refresh_token may be undefined if not provided.
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    const upsertSql = `
      INSERT INTO gmail_accounts
        (profile_id, google_user_id, email, display_name, access_token, refresh_token, scope, token_type, expires_at, revoked)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, (now() + ($9 || ' seconds')::interval), false)
      ON CONFLICT (google_user_id)
      DO UPDATE SET
        profile_id = COALESCE(EXCLUDED.profile_id, gmail_accounts.profile_id),
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        access_token = EXCLUDED.access_token,
        -- only update refresh_token if EXCLUDED provides one (Google sometimes omits it)
        refresh_token = COALESCE(EXCLUDED.refresh_token, gmail_accounts.refresh_token),
        scope = EXCLUDED.scope,
        token_type = EXCLUDED.token_type,
        expires_at = (now() + ($9 || ' seconds')::interval),
        revoked = false,
        updated_at = now()
      RETURNING id, google_user_id, email, display_name, expires_at, scope;
    `;

    const expiresSeconds = expires_in ? String(expires_in) : '3600';

    const res = await client.query(upsertSql, [
      profileId || null,
      googleUserId,
      email,
      displayName,
      access_token,
      refresh_token || null,
      scope || null,
      token_type || null,
      expiresSeconds
    ]);

    const account = res.rows[0];

    // Insert a quick import run record for PoC (optional)
    const importRunSql = `
      INSERT INTO gmail_import_runs (account_id, status, details)
      VALUES ($1, $2, $3)
      RETURNING id, started_at;
    `;
    await client.query(importRunSql, [account.id, 'created', { note: 'oauth_callback' }]);

    await client.query('COMMIT');

    // Return sanitized account info
    return {
      id: account.id,
      google_user_id: account.google_user_id,
      email: account.email,
      display_name: account.display_name,
      expires_at: account.expires_at,
      scope: account.scope
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// List linked accounts (PoC). In production, filter by current user.
export async function listLinkedAccounts(profileId?: string) {
  const client = await getPool().connect();
  try {
    const q = profileId
      ? { text: 'SELECT id, google_user_id, email, display_name, expires_at, scope, revoked FROM gmail_accounts WHERE profile_id = $1', values: [profileId] }
      : { text: 'SELECT id, google_user_id, email, display_name, expires_at, scope, revoked FROM gmail_accounts', values: [] };

    const res = await client.query(q.text, q.values);
    return res.rows;
  } finally {
    client.release();
  }
}