// app/backend/routes/opportunities.ts
// Opportunities API (minimal CRUD).
//
// Routes
// - GET   /api/opportunities?venue_id=
// - POST  /api/opportunities          { title, description?, venue_id? }
// - GET   /api/opportunities/:id
// - PATCH /api/opportunities/:id      { title?, description?, venue_id?, status?, next_action?, follow_up_due_date? }

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getDbPool } from '../lib/db';
import { verifyJwt } from '../lib/jwt';
import { getSessionToken } from '../lib/session_token';
import { OPPORTUNITY_STATUSES, createOpportunity, getOpportunityById, listOpportunities, updateOpportunity } from '../lib/opportunities';

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
  if (typeof x !== 'string') return null;
  const s = x.trim();
  return s ? s : null;
}

export default async function opportunitiesRoutes(fastify: FastifyInstance) {
  fastify.get('/api/opportunities', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireSession(request, reply)) return;

    const query = (request.query || {}) as any;
    const venue_id = typeof query?.venue_id === 'string' ? query.venue_id : undefined;
    const follow_up = typeof query?.follow_up === 'string' ? query.follow_up : undefined;
    const todayUtc = typeof follow_up === 'string' ? new Date().toISOString().slice(0, 10) : undefined;

    let client: any;
    try {
      client = await getDbPool().connect();
    } catch {
      return reply.status(500).send({ error: 'server_error' });
    }

    try {
      const filter: any = {};
      if (typeof venue_id === 'string') filter.venue_id = venue_id;
      if (typeof follow_up === 'string') {
        if (follow_up !== 'due' && follow_up !== 'overdue') {
          return reply.status(400).send({ error: 'invalid_request' });
        }
        filter.follow_up = follow_up;
        filter.today = todayUtc;
      }

      const opportunities = await listOpportunities(client, Object.keys(filter).length ? filter : undefined);
      return reply.send(opportunities);
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

  fastify.post('/api/opportunities', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireSession(request, reply)) return;

    const body = (request.body || {}) as any;
    const title = asNonEmptyString(body?.title);

    if (!title) {
      return reply.status(400).send({ error: 'invalid_request' });
    }

    if (Object.prototype.hasOwnProperty.call(body, 'description')) {
      if (body.description !== null && typeof body.description !== 'string') {
        return reply.status(400).send({ error: 'invalid_request' });
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'venue_id')) {
      if (body.venue_id !== null && typeof body.venue_id !== 'string') {
        return reply.status(400).send({ error: 'invalid_request' });
      }
      if (typeof body.venue_id === 'string' && !body.venue_id.trim()) {
        return reply.status(400).send({ error: 'invalid_request' });
      }
    }

    let client: any;
    try {
      client = await getDbPool().connect();
    } catch {
      return reply.status(500).send({ error: 'server_error' });
    }

    try {
      const created = await createOpportunity(client, {
        title,
        description: Object.prototype.hasOwnProperty.call(body, 'description') ? body.description : undefined,
        venue_id: Object.prototype.hasOwnProperty.call(body, 'venue_id') ? body.venue_id : undefined
      });
      return reply.send(created);
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

  fastify.get('/api/opportunities/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireSession(request, reply)) return;

    const params = (request.params || {}) as any;
    const id = params?.id;
    if (!id || typeof id !== 'string') {
      return reply.status(400).send({ error: 'invalid_request' });
    }

    let client: any;
    try {
      client = await getDbPool().connect();
    } catch {
      return reply.status(500).send({ error: 'server_error' });
    }

    try {
      const row = await getOpportunityById(client, id);
      if (!row) {
        return reply.status(404).send({ error: 'not_found' });
      }
      return reply.send(row);
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

  fastify.patch('/api/opportunities/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireSession(request, reply)) return;

    const params = (request.params || {}) as any;
    const id = params?.id;
    if (!id || typeof id !== 'string') {
      return reply.status(400).send({ error: 'invalid_request' });
    }

    const body = (request.body || {}) as any;
    const patch: any = {};
    let provided = false;

    if (Object.prototype.hasOwnProperty.call(body, 'title')) {
      provided = true;
      if (body.title === null || typeof body.title !== 'string') return reply.status(400).send({ error: 'invalid_request' });
      const title = body.title.trim();
      if (!title) return reply.status(400).send({ error: 'invalid_request' });
      patch.title = title;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'description')) {
      provided = true;
      if (body.description !== null && typeof body.description !== 'string') {
        return reply.status(400).send({ error: 'invalid_request' });
      }
      patch.description = body.description;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'venue_id')) {
      provided = true;
      if (body.venue_id !== null && typeof body.venue_id !== 'string') {
        return reply.status(400).send({ error: 'invalid_request' });
      }
      if (typeof body.venue_id === 'string' && !body.venue_id.trim()) {
        return reply.status(400).send({ error: 'invalid_request' });
      }
      patch.venue_id = body.venue_id;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      provided = true;
      if (body.status === null || typeof body.status !== 'string') {
        return reply.status(400).send({ error: 'invalid_request' });
      }
      if (!OPPORTUNITY_STATUSES.includes(body.status)) {
        return reply.status(400).send({ error: 'invalid_request' });
      }
      patch.status = body.status;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'next_action')) {
      provided = true;
      if (body.next_action !== null && typeof body.next_action !== 'string') {
        return reply.status(400).send({ error: 'invalid_request' });
      }
      patch.next_action = body.next_action;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'follow_up_due_date')) {
      provided = true;
      if (body.follow_up_due_date !== null && typeof body.follow_up_due_date !== 'string') {
        return reply.status(400).send({ error: 'invalid_request' });
      }
      patch.follow_up_due_date = body.follow_up_due_date;
    }

    if (!provided) {
      return reply.status(400).send({ error: 'invalid_request' });
    }

    let client: any;
    try {
      client = await getDbPool().connect();
    } catch {
      return reply.status(500).send({ error: 'server_error' });
    }

    try {
      const updated = await updateOpportunity(client, id, patch);
      if (!updated) {
        return reply.status(404).send({ error: 'not_found' });
      }
      return reply.send(updated);
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
