import { FastifyRequest } from 'fastify';

export function getBearerToken(req: FastifyRequest): string | null {
  const raw = (req.headers as any)?.authorization;
  if (!raw || typeof raw !== 'string') return null;
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export function getCookieToken(req: FastifyRequest): string | null {
  const raw = (req.headers as any)?.cookie;
  if (!raw || typeof raw !== 'string') return null;

  const cookieName = process.env.APP_SESSION_COOKIE_NAME || 'app_session';
  const parts = raw.split(';');
  for (const p of parts) {
    const [k, ...rest] = p.trim().split('=');
    if (k === cookieName) {
      const v = rest.join('=');
      if (!v) return null;
      try {
        return decodeURIComponent(v);
      } catch {
        return v;
      }
    }
  }
  return null;
}

export function getSessionToken(req: FastifyRequest): string | null {
  return getBearerToken(req) || getCookieToken(req);
}
