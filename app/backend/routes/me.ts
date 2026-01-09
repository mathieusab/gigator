// app/backend/routes/me.ts
// Route definitions for the current user's profile.
//
// Routes
// - GET /api/me => returns { id, email, full_name, avatar_url }

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { verifyJwt } from '../lib/jwt';

function getBearerToken(req: FastifyRequest): string | null {
  const raw = (req.headers as any)?.authorization;
  if (!raw || typeof raw !== 'string') return null;
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function getCookieToken(req: FastifyRequest): string | null {
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

export default async function meRoutes(fastify: FastifyInstance) {
  fastify.get('/api/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = getBearerToken(request) || getCookieToken(request);
    if (!token) {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    const secret = process.env.APP_JWT_SECRET;
    if (!secret) {
      return reply.status(500).send({ error: 'server_error' });
    }

    try {
      const payload = verifyJwt(token, secret) as any;
      return reply.send({
        id: payload?.sub,
        email: payload?.email,
        full_name: payload?.full_name,
        avatar_url: payload?.avatar_url
      });
    } catch {
      return reply.status(401).send({ error: 'unauthorized' });
    }
  });
}
