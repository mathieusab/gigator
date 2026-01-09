// app/backend/routes/me.ts
// Route definitions for the current user's profile.
//
// Routes
// - GET /api/me => returns { id, email, full_name, avatar_url }

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { verifyJwt } from '../lib/jwt';
import { getSessionToken } from '../lib/session_token';

export default async function meRoutes(fastify: FastifyInstance) {
  fastify.get('/api/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = getSessionToken(request);
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

