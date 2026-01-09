// app/backend/routes/search.ts
// Global search endpoint.
//
// Routes
// - GET /api/search?q=

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getDbPool } from '../lib/db';
import { verifyJwt } from '../lib/jwt';
import { searchAll } from '../lib/search';
import { getSessionToken } from '../lib/session_token';

const MAX_QUERY_LENGTH = 200;

function requireSession(request: FastifyRequest, reply: FastifyReply): { sub: string; email?: string } | null {
  const token = getSessionToken(request);
  if (!token) {
    reply.status(401).send({ error: 'unauthorized' });
    return null;
  }

  const secret = process.env.APP_JWT_SECRET;
  if (!secret) {
    reply.status(500).send({ error: 'server_error' });
    return null;
  }

  try {
    const payload = verifyJwt(token, secret) as any;
    const sub = String(payload?.sub || '').trim();
    if (!sub) {
      reply.status(401).send({ error: 'unauthorized' });
      return null;
    }
    return { sub, email: payload?.email };
  } catch {
    reply.status(401).send({ error: 'unauthorized' });
    return null;
  }
}

export default async function searchRoutes(fastify: FastifyInstance) {
  fastify.get('/api/search', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireSession(request, reply)) return;

    const query = (request.query || {}) as any;
    const q = query?.q;
    if (!q || typeof q !== 'string' || !q.trim()) {
      return reply.status(400).send({ error: 'invalid_request' });
    }

    if (q.trim().length > MAX_QUERY_LENGTH) {
      return reply.status(400).send({ error: 'invalid_request' });
    }

    let client: any;
    try {
      client = await getDbPool().connect();
    } catch {
      return reply.status(500).send({ error: 'server_error' });
    }

    try {
      const results = await searchAll(client, q);
      return reply.send(results);
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'invalid_request') {
        return reply.status(400).send({ error: 'invalid_request' });
      }
      return reply.status(500).send({ error: 'server_error' });
    } finally {
      client.release();
    }
  });
}
