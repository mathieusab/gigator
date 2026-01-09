// app/backend/routes/contact_venues.ts
// Contact ↔ Venue link API.
//
// Routes
// - POST   /api/contacts/:id/venues        { venue_id }
// - DELETE /api/contacts/:id/venues/:venue_id
// - GET    /api/contacts/:id/venues
// - GET    /api/venues/:id/contacts

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Pool } from 'pg';
import { verifyJwt } from '../lib/jwt';
import { getSessionToken } from '../lib/session_token';
import {
  linkContactToVenue,
  listContactsForVenue,
  listVenuesForContact,
  unlinkContactFromVenue
} from '../lib/contact_venues';

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

export default async function contactVenuesRoutes(fastify: FastifyInstance) {
  fastify.post('/api/contacts/:id/venues', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireSession(request, reply)) return;

    const params = (request.params || {}) as any;
    const contactId = params?.id;
    if (!contactId || typeof contactId !== 'string') {
      return reply.status(400).send({ error: 'invalid_request' });
    }

    const body = (request.body || {}) as any;
    const venueId = body?.venue_id;
    if (!venueId || typeof venueId !== 'string' || !venueId.trim()) {
      return reply.status(400).send({ error: 'invalid_request' });
    }

    let client: any;
    try {
      client = await getPool().connect();
    } catch {
      return reply.status(500).send({ error: 'server_error' });
    }

    try {
      await linkContactToVenue(client, contactId, venueId);
      return reply.send({ ok: true });
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'invalid_request') return reply.status(400).send({ error: 'invalid_request' });
      return reply.status(500).send({ error: 'server_error' });
    } finally {
      client.release();
    }
  });

  fastify.delete('/api/contacts/:id/venues/:venue_id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireSession(request, reply)) return;

    const params = (request.params || {}) as any;
    const contactId = params?.id;
    const venueId = params?.venue_id;

    if (!contactId || typeof contactId !== 'string') {
      return reply.status(400).send({ error: 'invalid_request' });
    }
    if (!venueId || typeof venueId !== 'string') {
      return reply.status(400).send({ error: 'invalid_request' });
    }

    let client: any;
    try {
      client = await getPool().connect();
    } catch {
      return reply.status(500).send({ error: 'server_error' });
    }

    try {
      await unlinkContactFromVenue(client, contactId, venueId);
      return reply.send({ ok: true });
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'invalid_request') return reply.status(400).send({ error: 'invalid_request' });
      return reply.status(500).send({ error: 'server_error' });
    } finally {
      client.release();
    }
  });

  fastify.get('/api/contacts/:id/venues', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireSession(request, reply)) return;

    const params = (request.params || {}) as any;
    const contactId = params?.id;
    if (!contactId || typeof contactId !== 'string') {
      return reply.status(400).send({ error: 'invalid_request' });
    }

    let client: any;
    try {
      client = await getPool().connect();
    } catch {
      return reply.status(500).send({ error: 'server_error' });
    }

    try {
      const venues = await listVenuesForContact(client, contactId);
      return reply.send(venues);
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'invalid_request') return reply.status(400).send({ error: 'invalid_request' });
      return reply.status(500).send({ error: 'server_error' });
    } finally {
      client.release();
    }
  });

  fastify.get('/api/venues/:id/contacts', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireSession(request, reply)) return;

    const params = (request.params || {}) as any;
    const venueId = params?.id;
    if (!venueId || typeof venueId !== 'string') {
      return reply.status(400).send({ error: 'invalid_request' });
    }

    let client: any;
    try {
      client = await getPool().connect();
    } catch {
      return reply.status(500).send({ error: 'server_error' });
    }

    try {
      const contacts = await listContactsForVenue(client, venueId);
      return reply.send(contacts);
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'invalid_request') return reply.status(400).send({ error: 'invalid_request' });
      return reply.status(500).send({ error: 'server_error' });
    } finally {
      client.release();
    }
  });
}
