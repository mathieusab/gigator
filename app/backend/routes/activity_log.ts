// app/backend/routes/activity_log.ts
// Activity log + non-email interaction API.
//
// Routes
// - GET  /api/opportunities/:id/activity
// - POST /api/opportunities/:id/interactions  { channel, occurred_at?, notes? }

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getDbPool } from '../lib/db';
import { verifyJwt } from '../lib/jwt';
import { getSessionToken } from '../lib/session_token';
import { appendNonEmailInteraction, listActivityForOpportunity } from '../lib/activity_log';
import { getOpportunityById } from '../lib/opportunities';

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

function asNonEmptyString(x: unknown): string | null {
  const s = typeof x === 'string' ? x.trim() : '';
  return s ? s : null;
}

function parseOptionalLimit(x: unknown): number | undefined {
  if (typeof x === 'undefined') return undefined;
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  if (typeof x === 'string' && x.trim()) {
    const n = Number(x);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

export default async function activityLogRoutes(fastify: FastifyInstance) {
  fastify.get('/api/opportunities/:id/activity', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = requireSession(request, reply);
    if (!session) return;

    const params = request.params as any;
    const opportunityId = asNonEmptyString(params?.id);
    if (!opportunityId) return reply.status(400).send({ error: 'invalid_request' });

    const query = (request.query || {}) as any;
    const limit = parseOptionalLimit(query?.limit);
    if (typeof limit === 'number' && !Number.isFinite(limit)) {
      return reply.status(400).send({ error: 'invalid_request' });
    }

    let client: any;
    try {
      const dbPool = (fastify as any).dbPool ?? getDbPool();
      client = await dbPool.connect();
    } catch {
      return reply.status(500).send({ error: 'server_error' });
    }

    try {
      const opportunity = await getOpportunityById(client, opportunityId);
      if (!opportunity) return reply.status(404).send({ error: 'not_found' });

      const events = await listActivityForOpportunity(client, opportunityId, typeof limit === 'number' ? { limit } : {});
      return reply.send(events);
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'invalid_request') return reply.status(400).send({ error: 'invalid_request' });
      return reply.status(500).send({ error: 'server_error' });
    } finally {
      client?.release?.();
    }
  });

  fastify.post('/api/opportunities/:id/interactions', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = requireSession(request, reply);
    if (!session) return;

    const params = request.params as any;
    const opportunityId = asNonEmptyString(params?.id);
    if (!opportunityId) return reply.status(400).send({ error: 'invalid_request' });

    const body = (request.body || {}) as any;
    const channel = body?.channel;
    const occurred_at = typeof body?.occurred_at === 'undefined' ? undefined : body?.occurred_at;
    const notes = typeof body?.notes === 'undefined' ? undefined : body?.notes;

    let client: any;
    try {
      const dbPool = (fastify as any).dbPool ?? getDbPool();
      client = await dbPool.connect();
    } catch {
      return reply.status(500).send({ error: 'server_error' });
    }

    try {
      const opportunity = await getOpportunityById(client, opportunityId);
      if (!opportunity) return reply.status(404).send({ error: 'not_found' });

      const event = await appendNonEmailInteraction(client, {
        opportunity_id: opportunityId,
        actor_profile_id: session.sub,
        channel,
        occurred_at,
        notes
      } as any);

      return reply.send(event);
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'invalid_request') return reply.status(400).send({ error: 'invalid_request' });
      if (msg === 'failed_to_create') return reply.status(500).send({ error: 'server_error' });
      return reply.status(500).send({ error: 'server_error' });
    } finally {
      client?.release?.();
    }
  });
}
