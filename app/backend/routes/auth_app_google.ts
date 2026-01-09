// app/backend/routes/auth_app_google.ts
// Fastify route definitions for "app login" Google OAuth.
//
// Routes
// - POST /api/auth/google/start => returns { oauth_url }

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  AccessDeniedError,
  getAppAuthUrl,
  handleAppOAuthCallback,
  isInvalidOAuthStateError,
  isOAuthConfigError
} from '../controllers/auth_app';

function getAppSessionCookieName(): string {
  return process.env.APP_SESSION_COOKIE_NAME || 'app_session';
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function redactTokensInString(s: string): string {
  return s
    .replace(/("refresh_token"\s*:\s*")([^"]+)(")/gi, '$1[REDACTED]$3')
    .replace(/("id_token"\s*:\s*")([^"]+)(")/gi, '$1[REDACTED]$3')
    .replace(/("access_token"\s*:\s*")([^"]+)(")/gi, '$1[REDACTED]$3')
    .replace(/\b(refresh_token|id_token)\s*=\s*([^\s&]+)/gi, '$1=[REDACTED]')
    .replace(/\baccess_token\s*=\s*([^\s&]+)/gi, 'access_token=[REDACTED]')
    .replace(/\b(refresh_token|id_token)\b\s*:\s*([^\s,}]+)/gi, '$1: [REDACTED]')
    .replace(/\b([a-z][a-z0-9+.-]*):\/\/([^\s:@/]+):([^@\s/]+)@/gi, '$1://$2:[REDACTED]@')
    .replace(/\b([a-z][a-z0-9+.-]*):\/\/:([^@\s/]+)@/gi, '$1://:[REDACTED]@');
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

export default async function authAppGoogleRoutes(fastify: FastifyInstance) {
  fastify.post('/api/auth/google/start', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const oauth_url = await getAppAuthUrl();
      return reply.send({ oauth_url });
    } catch (err) {
      const safeErr = sanitizeErrorForLog(err);

      if (isOAuthConfigError(err)) {
        fastify.log.error({ err: safeErr }, 'app oauth configuration error');
        return reply.status(400).send({
          error: 'oauth_config_error',
          message:
            'OAuth configuration missing or incomplete (requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_APP_OAUTH_REDIRECT_URI)'
        });
      }

      fastify.log.error({ err: safeErr }, 'failed to build app oauth url');
      return reply.status(500).send({
        error: 'failed_to_start_oauth',
        message: 'Unexpected error while building OAuth URL'
      });
    }
  });

  fastify.get('/api/auth/google/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const code = query?.code;
    const state = query?.state;

    if (!code) {
      return reply.status(400).send({ error: 'missing_code' });
    }

    try {
      const result = await handleAppOAuthCallback(code, state);

      const successRedirect = process.env.APP_OAUTH_SUCCESS_REDIRECT_URI;
      if (successRedirect) {
        // Store session token in an HttpOnly cookie to avoid exposing it in URLs.
        const cookieName = getAppSessionCookieName();
        const parts = [
          `${cookieName}=${encodeURIComponent(result.token)}`,
          'Path=/',
          'HttpOnly',
          'SameSite=Lax'
        ];
        if (isProduction()) parts.push('Secure');
        reply.header('Set-Cookie', parts.join('; '));
        return reply.redirect(302, successRedirect);
      }

      return reply.send(result);
    } catch (err: any) {
      const safeErr = sanitizeErrorForLog(err);
      const message = err instanceof Error ? err.message : String(err);

      if (isInvalidOAuthStateError(err) || message === 'invalid_oauth_state') {
        return reply.status(400).send({
          error: 'invalid_oauth_state',
          message: 'Invalid or expired OAuth state'
        });
      }

      if (err instanceof AccessDeniedError || message.includes('access_denied')) {
        return reply.status(403).send({
          error: 'access_denied',
          message: 'Access denied'
        });
      }

      if (isOAuthConfigError(err)) {
        return reply.status(400).send({
          error: 'oauth_config_error',
          message:
            'OAuth configuration missing or incomplete (requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_APP_OAUTH_REDIRECT_URI)'
        });
      }

      if (message === 'missing_database_url' || message === 'missing_app_jwt_secret') {
        fastify.log.error({ err: safeErr }, 'app oauth server configuration error');
        return reply.status(500).send({
          error: 'server_error',
          message: 'Server configuration error'
        });
      }

      fastify.log.error({ err: safeErr }, 'app oauth callback failed');
      return reply.status(500).send({
        error: 'oauth_exchange_failed',
        message: 'OAuth exchange failed'
      });
    }
  });
}
