// app/backend/routes/venues.ts
// Venues API (minimal CRUD).
//
// Routes
// - GET   /api/venues
// - POST  /api/venues          { name, city, notes? }
// - GET   /api/venues/:id
// - PATCH /api/venues/:id      { name?, city?, notes? }

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Pool } from 'pg';
import { verifyJwt } from '../lib/jwt';
import { getSessionToken } from '../lib/session_token';
import { createVenue, getVenueById, listVenues, updateVenue } from '../lib/venues';

let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('missing_database_url');
    pool = new Pool({ connectionString: url });
  }
  return pool;
}

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
    return { sub: String(payload?.sub || ''), email: payload?.email };
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

export default async function venuesRoutes(fastify: FastifyInstance) {
  fastify.get('/api/venues', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireSession(request, reply)) return;

    let client: any;
    try {
      client = await getPool().connect();
    } catch {
      return reply.status(500).send({ error: 'server_error' });
    }

    try {
      const venues = await listVenues(client);
      return reply.send(venues);
    } finally {
      client.release();
    }
  });

  fastify.post('/api/venues', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireSession(request, reply)) return;

    const body = (request.body || {}) as any;
    const name = asNonEmptyString(body?.name);
    const city = asNonEmptyString(body?.city);

    if (!name || !city) {
      return reply.status(400).send({ error: 'invalid_request' });
    }

    if (typeof body?.notes !== 'undefined' && body?.notes !== null && typeof body?.notes !== 'string') {
      return reply.status(400).send({ error: 'invalid_request' });
    }

    let client: any;
    try {
      client = await getPool().connect();
    } catch {
      return reply.status(500).send({ error: 'server_error' });
    }

    try {
      const created = await createVenue(client, {
        name,
        city,
        notes: typeof body?.notes === 'undefined' ? undefined : body?.notes
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

  fastify.get('/api/venues/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireSession(request, reply)) return;

    const params = (request.params || {}) as any;
    const id = params?.id;
    if (!id || typeof id !== 'string') {
      return reply.status(400).send({ error: 'invalid_request' });
    }

    let client: any;
    try {
      client = await getPool().connect();
    } catch {
      return reply.status(500).send({ error: 'server_error' });
    }

    try {
      const venue = await getVenueById(client, id);
      if (!venue) {
        return reply.status(404).send({ error: 'not_found' });
      }
      return reply.send(venue);
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

  fastify.patch('/api/venues/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireSession(request, reply)) return;

    const params = (request.params || {}) as any;
    const id = params?.id;
    if (!id || typeof id !== 'string') {
      return reply.status(400).send({ error: 'invalid_request' });
    }

    const body = (request.body || {}) as any;

    const patch: any = {};
    let provided = false;

    if (Object.prototype.hasOwnProperty.call(body, 'name')) {
      provided = true;
      if (body.name === null || typeof body.name !== 'string') return reply.status(400).send({ error: 'invalid_request' });
      const name = body.name.trim();
      if (!name) return reply.status(400).send({ error: 'invalid_request' });
      patch.name = name;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'city')) {
      provided = true;
      if (body.city === null || typeof body.city !== 'string') return reply.status(400).send({ error: 'invalid_request' });
      const city = body.city.trim();
      if (!city) return reply.status(400).send({ error: 'invalid_request' });
      patch.city = city;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'notes')) {
      provided = true;
      if (body.notes !== null && typeof body.notes !== 'string') return reply.status(400).send({ error: 'invalid_request' });
      patch.notes = body.notes;
    }

    if (!provided) {
      return reply.status(400).send({ error: 'invalid_request' });
    }

    let client: any;
    try {
      client = await getPool().connect();
    } catch {
      return reply.status(500).send({ error: 'server_error' });
    }

    try {
      const updated = await updateVenue(client, id, patch);
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
