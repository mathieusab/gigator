import type { Request, Response } from 'express';
import { Router } from 'express';
import crypto from 'node:crypto';
import { GmailProxyError, getMessageById, getThreadById, listThreadsForEmail } from '../proxy/gmail.js';
import { analyzeThreadHeuristic } from '../lib/gmailThreadAnalysis.js';
import { decryptToken, encryptToken, hmacSha256Base64Url } from '../lib/cryptoTokens.js';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { getBearerTokenFromHeader, verifySupabaseAccessToken } from '../lib/supabaseJwt.js';

export const gmailRouter = Router();

function requireEnv(name: string): string {
  const v = process.env[name] ?? '';
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function safeRedirectPath(path: string): string {
  const trimmed = String(path ?? '').trim();
  if (!trimmed) return '/';
  // Only allow relative paths to avoid open redirects.
  if (!trimmed.startsWith('/')) return '/';
  if (trimmed.startsWith('//')) return '/';
  return trimmed;
}

type OAuthState = {
  uid: string;
  redirectTo: string;
  nonce: string;
};

function encodeState(payload: OAuthState, secret: string): string {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json, 'utf8').toString('base64url');
  const sig = hmacSha256Base64Url(b64, secret);
  return `${b64}.${sig}`;
}

function decodeState(state: string, secret: string): OAuthState {
  const parts = String(state ?? '').split('.');
  if (parts.length !== 2) throw new Error('Invalid state');
  const [b64, sig] = parts;
  const expected = hmacSha256Base64Url(b64, secret);
  if (sig !== expected) throw new Error('Invalid state signature');
  const json = Buffer.from(b64, 'base64url').toString('utf8');
  const parsed = JSON.parse(json) as OAuthState;
  if (!parsed.uid) throw new Error('Invalid state payload');
  return parsed;
}

async function requireActiveAppUserId(req: Request): Promise<string> {
  const token = getBearerTokenFromHeader(req.header('authorization'));
  if (!token) throw new GmailProxyError(401, 'Missing Authorization Bearer token');

  const { userId } = await verifySupabaseAccessToken(token);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('app_users')
    .select('id,is_active')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.is_active) throw new GmailProxyError(403, 'Access denied');

  return userId;
}

async function exchangeRefreshTokenForAccessToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<string> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    refresh_token: params.refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    throw new GmailProxyError(401, 'Failed to refresh Gmail access token. Reconnect Gmail.');
  }

  const json = (await res.json()) as { access_token?: string };
  const accessToken = String(json.access_token ?? '').trim();
  if (!accessToken)
    throw new GmailProxyError(401, 'Failed to refresh Gmail access token. Reconnect Gmail.');
  return accessToken;
}

gmailRouter.get('/connection', async (req: Request, res: Response) => {
  try {
    const userId = await requireActiveAppUserId(req);
    const supabase = getSupabaseAdmin();
    const { data: conn, error } = await supabase
      .from('gmail_connections')
      .select('gmail_email')
      .eq('app_user_id', userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!conn?.gmail_email) {
      return res.status(401).json({ error: 'Gmail not connected' });
    }

    return res.json({ gmailEmail: String(conn.gmail_email) });
  } catch (e) {
    if (e instanceof GmailProxyError) return res.status(e.status).json({ error: e.message });
    return res
      .status(500)
      .json({ error: e instanceof Error ? e.message : 'Failed to get Gmail connection' });
  }
});

async function getGmailAccessTokenForRequest(req: Request): Promise<string> {
  const clientId = process.env.GMAIL_PROXY_CLIENT_ID ?? '';
  const clientSecret = process.env.GMAIL_PROXY_CLIENT_SECRET ?? '';
  if (!clientId || !clientSecret) {
    throw new GmailProxyError(500, 'Gmail proxy is not configured');
  }

  const tokenKey = process.env.GMAIL_TOKEN_ENCRYPTION_KEY ?? '';
  if (!tokenKey) {
    throw new GmailProxyError(500, 'Gmail token encryption is not configured');
  }

  const userId = await requireActiveAppUserId(req);
  const supabase = getSupabaseAdmin();
  const { data: conn, error: connErr } = await supabase
    .from('gmail_connections')
    .select('refresh_token_ciphertext,refresh_token_iv,refresh_token_tag')
    .eq('app_user_id', userId)
    .maybeSingle();

  if (connErr) throw new Error(connErr.message);
  if (!conn) throw new GmailProxyError(401, 'Gmail not connected');

  const refreshToken = decryptToken(
    {
      ciphertextB64: conn.refresh_token_ciphertext,
      ivB64: conn.refresh_token_iv,
      tagB64: conn.refresh_token_tag,
    },
    tokenKey,
  );

  return await exchangeRefreshTokenForAccessToken({
    refreshToken,
    clientId,
    clientSecret,
  });
}

gmailRouter.post('/oauth/start', async (req: Request, res: Response) => {
  try {
    const userId = await requireActiveAppUserId(req);

    const clientId = process.env.GMAIL_PROXY_CLIENT_ID ?? '';
    const clientSecret = process.env.GMAIL_PROXY_CLIENT_SECRET ?? '';
    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: 'Gmail proxy is not configured' });
    }

    const redirectUri = requireEnv('GMAIL_OAUTH_REDIRECT_URI');
    const stateSecret = requireEnv('GMAIL_OAUTH_STATE_SECRET');
    const redirectTo = safeRedirectPath(String((req.body as any)?.redirectTo ?? '/'));

    const nonce = crypto.randomBytes(16).toString('base64url');
    const state = encodeState({ uid: userId, redirectTo, nonce }, stateSecret);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/gmail.readonly email',
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return res.json({ url });
  } catch (e) {
    if (e instanceof GmailProxyError) return res.status(e.status).json({ error: e.message });
    return res
      .status(500)
      .json({ error: e instanceof Error ? e.message : 'Failed to start Gmail OAuth' });
  }
});

gmailRouter.get('/oauth/callback', async (req: Request, res: Response) => {
  try {
    const code = String(req.query.code ?? '').trim();
    const state = String(req.query.state ?? '').trim();
    if (!code || !state) {
      return res.status(400).send('Missing code/state');
    }

    const stateSecret = requireEnv('GMAIL_OAUTH_STATE_SECRET');
    const tokenKey = requireEnv('GMAIL_TOKEN_ENCRYPTION_KEY');
    const redirectUri = requireEnv('GMAIL_OAUTH_REDIRECT_URI');
    const frontendOrigin = process.env.FRONTEND_ORIGIN ?? '';

    const decoded = decodeState(state, stateSecret);

    const clientId = process.env.GMAIL_PROXY_CLIENT_ID ?? '';
    const clientSecret = process.env.GMAIL_PROXY_CLIENT_SECRET ?? '';
    if (!clientId || !clientSecret) {
      return res.status(500).send('Gmail proxy is not configured');
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const tokenJson = (await tokenRes.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      scope?: string;
    };

    if (!tokenRes.ok) {
      return res.status(400).send('Failed to exchange OAuth code');
    }

    const accessToken = String(tokenJson.access_token ?? '').trim();
    const refreshToken = String(tokenJson.refresh_token ?? '').trim();
    if (!accessToken) {
      return res.status(400).send('Missing access token');
    }
    if (!refreshToken) {
      return res
        .status(400)
        .send(
          'Missing refresh token. Try again with prompt=consent or revoke the app in Google Account settings.',
        );
    }

    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profileJson = (await profileRes.json().catch(() => ({}))) as { emailAddress?: string };
    const gmailEmail = String(profileJson.emailAddress ?? '').trim();
    if (!profileRes.ok || !gmailEmail) {
      return res.status(400).send('Failed to read Gmail profile');
    }

    const enc = encryptToken(refreshToken, tokenKey);
    const scopes = String(tokenJson.scope ?? '').trim();

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('gmail_connections').upsert(
      {
        app_user_id: decoded.uid,
        gmail_email: gmailEmail,
        refresh_token_ciphertext: enc.ciphertextB64,
        refresh_token_iv: enc.ivB64,
        refresh_token_tag: enc.tagB64,
        scopes: scopes ? scopes.split(' ') : null,
        last_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'app_user_id' },
    );

    if (error) {
      return res.status(500).send('Failed to store Gmail connection');
    }

    const redirectTo = safeRedirectPath(decoded.redirectTo);
    if (!frontendOrigin) {
      const escaped = redirectTo
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      return res
        .status(200)
        .type('html')
        .send(
          `<!doctype html><html><head><meta charset="utf-8" /><title>Gmail connected</title></head>` +
            `<body style="font-family:system-ui,sans-serif;padding:24px;max-width:720px;margin:0 auto">` +
            `<h1 style="margin:0 0 12px">Gmail connecté</h1>` +
            `<p>Vous pouvez fermer cet onglet et revenir à l’application.</p>` +
            `<p><a href="${escaped}">Retour</a></p>` +
            `</body></html>`,
        );
    }
    return res.redirect(`${frontendOrigin.replace(/\/$/, '')}${redirectTo}`);
  } catch (e) {
    return res.status(500).send(e instanceof Error ? e.message : 'OAuth callback error');
  }
});

gmailRouter.get('/threads', async (req: Request, res: Response) => {
  const email = String(req.query.email ?? '').trim();
  if (!email) {
    return res.status(400).json({ error: 'Missing required query param: email' });
  }

  const maxThreadsRaw = String(req.query.maxThreads ?? '').trim();
  const maxThreadsParsed = maxThreadsRaw ? Number(maxThreadsRaw) : NaN;
  const maxThreads = Number.isFinite(maxThreadsParsed)
    ? Math.max(1, Math.min(200, Math.floor(maxThreadsParsed)))
    : undefined;

  try {
    const clientId = process.env.GMAIL_PROXY_CLIENT_ID ?? '';
    const clientSecret = process.env.GMAIL_PROXY_CLIENT_SECRET ?? '';
    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: 'Gmail proxy is not configured' });
    }

    const accessToken = await getGmailAccessTokenForRequest(req);
    const threads = await listThreadsForEmail(
      { clientId, clientSecret, accessToken },
      email,
      { maxThreads },
    );
    return res.json(threads);
  } catch (e) {
    if (e instanceof GmailProxyError) {
      return res.status(e.status).json({ error: e.message });
    }
    return res.status(500).json({ error: 'Failed to query Gmail' });
  }
});

gmailRouter.get('/threads/:threadId', async (req: Request, res: Response) => {
  const threadId = String(req.params.threadId ?? '').trim();
  if (!threadId) {
    return res.status(400).json({ error: 'Missing required route param: threadId' });
  }

  try {
    const clientId = process.env.GMAIL_PROXY_CLIENT_ID ?? '';
    const clientSecret = process.env.GMAIL_PROXY_CLIENT_SECRET ?? '';
    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: 'Gmail proxy is not configured' });
    }

    const accessToken = await getGmailAccessTokenForRequest(req);
    const thread = await getThreadById({ clientId, clientSecret, accessToken }, threadId);
    return res.json(thread);
  } catch (e) {
    if (e instanceof GmailProxyError) {
      return res.status(e.status).json({ error: e.message });
    }
    return res.status(500).json({ error: 'Failed to query Gmail thread' });
  }
});

gmailRouter.post('/threads/:threadId/analyze', async (req: Request, res: Response) => {
  const threadId = String(req.params.threadId ?? '').trim();
  if (!threadId) {
    return res.status(400).json({ error: 'Missing required route param: threadId' });
  }

  try {
    const clientId = process.env.GMAIL_PROXY_CLIENT_ID ?? '';
    const clientSecret = process.env.GMAIL_PROXY_CLIENT_SECRET ?? '';
    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: 'Gmail proxy is not configured' });
    }

    const accessToken = await getGmailAccessTokenForRequest(req);
    const thread = await getThreadById({ clientId, clientSecret, accessToken }, threadId);
    const suggestion = analyzeThreadHeuristic(thread);
    return res.json(suggestion);
  } catch (e) {
    if (e instanceof GmailProxyError) {
      return res.status(e.status).json({ error: e.message });
    }
    return res.status(500).json({ error: 'Failed to analyze Gmail thread' });
  }
});

gmailRouter.get('/messages/:messageId', async (req: Request, res: Response) => {
  const messageId = String(req.params.messageId ?? '').trim();
  if (!messageId) {
    return res.status(400).json({ error: 'Missing required route param: messageId' });
  }

  try {
    const clientId = process.env.GMAIL_PROXY_CLIENT_ID ?? '';
    const clientSecret = process.env.GMAIL_PROXY_CLIENT_SECRET ?? '';
    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: 'Gmail proxy is not configured' });
    }

    const accessToken = await getGmailAccessTokenForRequest(req);
    const message = await getMessageById({ clientId, clientSecret, accessToken }, messageId);
    return res.json(message);
  } catch (e) {
    if (e instanceof GmailProxyError) {
      return res.status(e.status).json({ error: e.message });
    }
    return res.status(500).json({ error: 'Failed to query Gmail message' });
  }
});
