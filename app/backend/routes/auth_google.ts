// app/backend/routes/auth_google.ts
// Fastify route definitions for Gmail OAuth PoC.
//
// Routes
// - POST  /api/sync/gmail/start    => returns { oauth_url } to begin OAuth consent
// - GET   /api/sync/gmail/callback => OAuth2 redirect URI (exchanges code)
//
// This file is a minimal PoC. The actual exchange/DB persistence is implemented in
// the controller: [`app/backend/controllers/oauth.ts`](app/backend/controllers/oauth.ts:1).
//
// Environment expectations (set these in your dev env / secrets manager):
// - GOOGLE_CLIENT_ID
// - GOOGLE_CLIENT_SECRET
// - GOOGLE_OAUTH_REDIRECT_URI

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  getAuthUrl,
  handleOAuthCallback,
  listLinkedAccounts
} from '../controllers/oauth';

function redactTokensInString(s: string): string {
  // Defensive: never allow refresh_token / id_token to appear in logs or API responses.
  // Handles patterns like: "refresh_token": "...", refresh_token=..., id_token: ...
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

export default async function authGoogleRoutes(fastify: FastifyInstance) {
  // Start OAuth: return URL client should visit to authorize the app
  fastify.post('/api/sync/gmail/start', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // controller builds URL using client id, scopes, redirect_uri, state (and persists state)
      const oauth_url = await getAuthUrl();
      return reply.send({ oauth_url });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const safeErr = sanitizeErrorForLog(err);
      const isConfigError =
        message.includes('OAuth configuration incomplete') ||
        message.includes('GOOGLE_CLIENT_ID') ||
        message.includes('GOOGLE_CLIENT_SECRET') ||
        message.includes('GOOGLE_OAUTH_REDIRECT_URI');

      if (isConfigError) {
        // Missing/invalid server config
        fastify.log.error({ err: safeErr }, 'gmail oauth configuration error');
        return reply.status(400).send({
          error: 'oauth_config_error',
          message:
            'OAuth configuration missing or incomplete (requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI)'
        });
      }

      fastify.log.error({ err: safeErr }, 'failed to build gmail oauth url');
      return reply.status(500).send({
        error: 'failed_to_start_oauth',
        message: 'Unexpected error while building OAuth URL'
      });
    }
  });

  // OAuth callback: Google will redirect users here with ?code=...&state=...
  // This endpoint should be configured as the Authorized redirect URI in the Google Console.
  fastify.get('/api/sync/gmail/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const code = query?.code;
    const state = query?.state;

    if (!code) {
      return reply.status(400).send({ error: 'missing_code' });
    }

    try {
      // controller exchanges code for tokens, persists account, and returns a result object
      const result = await handleOAuthCallback(code, state, /* optional: currentUserId */ undefined);
      // For PoC we return the persisted account info (sanitized)
      return reply.send(result);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : String(err);
      const safeErr = sanitizeErrorForLog(err);
      fastify.log.error({ err: safeErr }, 'oauth callback exchange failed');

      const isInvalidState = message.includes('invalid_oauth_state');
      const isConfigError =
        message.includes('OAuth configuration incomplete') ||
        message.includes('GOOGLE_CLIENT_ID') ||
        message.includes('GOOGLE_CLIENT_SECRET') ||
        message.includes('GOOGLE_OAUTH_REDIRECT_URI');

      if (isInvalidState) {
        return reply.status(400).send({
          error: 'invalid_oauth_state',
          message: 'Invalid or expired OAuth state'
        });
      }

      if (isConfigError) {
        return reply.status(400).send({
          error: 'oauth_config_error',
          message:
            'OAuth configuration missing or incomplete (requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI)'
        });
      }

      // Do not echo raw upstream/provider error messages: they may include sensitive details.
      return reply.status(500).send({
        error: 'oauth_exchange_failed',
        message: 'OAuth exchange failed'
      });
    }
  });

  // List linked Gmail accounts (PoC placeholder).
  // In a real app this should be protected (auth required) and return only accounts for the current user.
  fastify.get('/api/sync/gmail/accounts', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const accounts = await listLinkedAccounts(/* optional: currentUserId */);
      return reply.send({ accounts });
    } catch (err) {
      const safeErr = sanitizeErrorForLog(err);
      fastify.log.error({ err: safeErr }, 'failed listing gmail accounts');
      return reply.status(500).send({ error: 'failed_list_accounts' });
    }
  });
}