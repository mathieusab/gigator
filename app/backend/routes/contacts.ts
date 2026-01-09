// app/backend/routes/contacts.ts
// Contacts API (minimal CRUD).
//
// Routes
// - GET   /api/contacts?q=
// - POST  /api/contacts          { name, email?, phone?, instagram?, notes? }
// - GET   /api/contacts/:id
// - PATCH /api/contacts/:id      { name?, email?, phone?, instagram?, notes? }

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Pool } from 'pg';
import { verifyJwt } from '../lib/jwt';
import { getSessionToken } from '../lib/session_token';
import { createContact, getContactById, listContacts, updateContact } from '../lib/contacts';

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

function asNonEmptyString(x: unknown): string | null {
  if (typeof x !== 'string') return null;
  const s = x.trim();
  return s ? s : null;
}

export default async function contactsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/contacts', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireSession(request, reply)) return;

    const query = (request.query || {}) as any;
    const q = typeof query?.q === 'string' ? query.q : undefined;

    let client: any;
    try {
      client = await getPool().connect();
    } catch {
      return reply.status(500).send({ error: 'server_error' });
    }

    try {
      const contacts = await listContacts(client, { q });
      return reply.send(contacts);
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

  fastify.post('/api/contacts', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireSession(request, reply)) return;

    const body = (request.body || {}) as any;
    const name = asNonEmptyString(body?.name);

    if (!name) {
      return reply.status(400).send({ error: 'invalid_request' });
    }

    const optionalFields = ['email', 'phone', 'instagram', 'notes'] as const;
    for (const key of optionalFields) {
      if (typeof body?.[key] !== 'undefined' && body?.[key] !== null && typeof body?.[key] !== 'string') {
        return reply.status(400).send({ error: 'invalid_request' });
      }
    }

    let client: any;
    try {
      client = await getPool().connect();
    } catch {
      return reply.status(500).send({ error: 'server_error' });
    }

    try {
      const created = await createContact(client, {
        name,
        email: typeof body?.email === 'undefined' ? undefined : body?.email,
        phone: typeof body?.phone === 'undefined' ? undefined : body?.phone,
        instagram: typeof body?.instagram === 'undefined' ? undefined : body?.instagram,
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

  fastify.get('/api/contacts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
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
      const contact = await getContactById(client, id);
      if (!contact) {
        return reply.status(404).send({ error: 'not_found' });
      }
      return reply.send(contact);
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

  fastify.patch('/api/contacts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
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

    const nullableStringFields = ['email', 'phone', 'instagram', 'notes'] as const;
    for (const key of nullableStringFields) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        provided = true;
        if (body[key] !== null && typeof body[key] !== 'string') return reply.status(400).send({ error: 'invalid_request' });
        patch[key] = body[key];
      }
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
      const updated = await updateContact(client, id, patch);
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
