// app/backend/controllers/auth_app.ts
// Controller helpers for Google OAuth "app login".
//
// Exports:
// - getAppAuthUrl(): Promise<string> -> build Google OAuth consent URL with minimal scopes (openid email profile)
//
// Environment expectations:
// - GOOGLE_CLIENT_ID
// - GOOGLE_CLIENT_SECRET
// - GOOGLE_APP_OAUTH_REDIRECT_URI

import crypto from 'crypto';
import { Pool } from 'pg';
import { isEmailAllowed, isEmailAllowedByEnv } from '../lib/allowlist';
import { signJwt } from '../lib/jwt';
import { deleteOauthState, getOauthState, persistOauthState } from '../lib/oauth_state_store';

class OAuthConfigError extends Error {
  code = 'OAUTH_CONFIG_ERROR' as const;
  constructor(message: string) {
    super(message);
    this.name = 'OAuthConfigError';
  }
}

class InvalidOAuthStateError extends Error {
  code = 'INVALID_OAUTH_STATE' as const;
  constructor(message = 'invalid_oauth_state') {
    super(message);
    this.name = 'InvalidOAuthStateError';
  }
}

export function isInvalidOAuthStateError(err: unknown): err is InvalidOAuthStateError {
  return (
    !!err &&
    typeof err === 'object' &&
    (err as any).code === 'INVALID_OAUTH_STATE' &&
    (err as any).name === 'InvalidOAuthStateError'
  );
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
    GOOGLE_APP_OAUTH_REDIRECT_URI: process.env.GOOGLE_APP_OAUTH_REDIRECT_URI,
    DATABASE_URL: process.env.DATABASE_URL
  };
}

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const { DATABASE_URL } = getEnvSnapshot();
    if (!DATABASE_URL) {
      throw new Error('missing_database_url');
    }
    pool = new Pool({ connectionString: DATABASE_URL });
  }
  return pool;
}

export class AccessDeniedError extends Error {
  code = 'ACCESS_DENIED' as const;
  constructor(message = 'access_denied') {
    super(message);
    this.name = 'AccessDeniedError';
  }
}

// Build the authorization URL for app login.
export async function getAppAuthUrl(): Promise<string> {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_APP_OAUTH_REDIRECT_URI } = getEnvSnapshot();

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_APP_OAUTH_REDIRECT_URI) {
    throw new OAuthConfigError(
      'OAuth configuration missing or incomplete (requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_APP_OAUTH_REDIRECT_URI)'
    );
  }

  // Minimal scopes for app login (no Gmail scopes here).
  const scopes = ['openid', 'email', 'profile'];

  // CSRF protection: cryptographically secure state persisted with TTL.
  const state = crypto.randomBytes(24).toString('hex');
  await persistOauthState(state, { created_at: new Date().toISOString(), flow: 'app_login' });

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_APP_OAUTH_REDIRECT_URI,
    response_type: 'code',
    scope: scopes.join(' '),
    state
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function handleAppOAuthCallback(code: string, state?: string) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_APP_OAUTH_REDIRECT_URI } = getEnvSnapshot();

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_APP_OAUTH_REDIRECT_URI) {
    throw new OAuthConfigError(
      'OAuth configuration missing or incomplete (requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_APP_OAUTH_REDIRECT_URI)'
    );
  }

  // Validate and consume state (CSRF protection).
  if (!state || typeof state !== 'string') {
    throw new InvalidOAuthStateError();
  }
  const stateMeta = await getOauthState(state);
  if (!stateMeta) {
    throw new InvalidOAuthStateError();
  }

  // Ensure this state belongs to the app-login flow.
  if ((stateMeta as any)?.flow && (stateMeta as any).flow !== 'app_login') {
    throw new InvalidOAuthStateError();
  }
  await deleteOauthState(state);

  // Exchange authorization code for access token.
  const TOKEN_URL = process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
  const body = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: GOOGLE_APP_OAUTH_REDIRECT_URI,
    grant_type: 'authorization_code'
  });

  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!tokenRes.ok) {
    throw new Error(`token exchange failed: ${tokenRes.status}`);
  }

  const tokenJson = (await tokenRes.json()) as any;
  const access_token = tokenJson?.access_token as string | undefined;
  if (!access_token) {
    throw new Error('missing_access_token');
  }

  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` }
  });

  if (!userInfoRes.ok) {
    throw new Error(`failed to fetch userinfo: ${userInfoRes.status}`);
  }

  const userInfo = (await userInfoRes.json()) as {
    sub?: string;
    email?: string;
    name?: string;
    picture?: string;
  };

  const googleUserId = userInfo.sub || null;
  const email = userInfo.email;
  const fullName = userInfo.name || null;
  const avatarUrl = userInfo.picture || null;

  if (!email) {
    throw new Error('missing_email');
  }

  // Enforce allowlist BEFORE establishing any session.
  const allowedByEnv = isEmailAllowedByEnv(email);
  if (allowedByEnv === false) {
    throw new AccessDeniedError('access_denied');
  }

  const client = await getPool().connect();
  try {
    if (allowedByEnv === null) {
      const allowed = await isEmailAllowed(client, email);
      if (!allowed) {
        throw new AccessDeniedError('access_denied');
      }
    }

    const upsertSql = `
      INSERT INTO profiles (email, full_name, avatar_url, google_user_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email)
      DO UPDATE SET
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        google_user_id = COALESCE(EXCLUDED.google_user_id, profiles.google_user_id),
        updated_at = now()
      RETURNING id, email, full_name, avatar_url;
    `;

    const res = await client.query(upsertSql, [email, fullName, avatarUrl, googleUserId]);
    const profile = res.rows[0];

    const secret = process.env.APP_JWT_SECRET;
    if (!secret) {
      throw new Error('missing_app_jwt_secret');
    }

    const token = signJwt(
      {
        sub: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url
      },
      secret
    );

    return {
      token,
      profile: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url
      }
    };
  } finally {
    client.release();
  }
}
