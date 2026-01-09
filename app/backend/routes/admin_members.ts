// app/backend/routes/admin_members.ts
// Admin API for managing the app email allowlist (members list).
//
// Routes
// - GET   /api/admin/members
// - POST  /api/admin/members   { email }
// - PATCH /api/admin/members/:id { is_active }

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getDbPool } from '../lib/db';
import { verifyJwt } from '../lib/jwt';
import { getSessionToken } from '../lib/session_token';
import { listMembers, setMemberActive, upsertInvite } from '../lib/admin_members';

function getAdminEmailsFromEnv(): string[] {
  const raw = process.env.APP_ADMIN_EMAILS;
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isAdmin(email: string | null | undefined): boolean {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return false;
  return getAdminEmailsFromEnv().includes(normalized);
}


function requireAdmin(request: FastifyRequest, reply: FastifyReply): { email: string } | null {
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
    const email = payload?.email as string | undefined;
    if (!isAdmin(email)) {
      reply.status(403).send({ error: 'forbidden' });
      return null;
    }
    return { email: String(email) };
  } catch {
    reply.status(401).send({ error: 'unauthorized' });
    return null;
  }
}

export default async function adminMembersRoutes(fastify: FastifyInstance) {
  fastify.get('/api/admin/members', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireAdmin(request, reply)) return;

    const client = await getDbPool().connect();
    try {
      const members = await listMembers(client);
      return reply.send(members);
    } finally {
      client.release();
    }
  });

  fastify.post('/api/admin/members', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireAdmin(request, reply)) return;

    const body = (request.body || {}) as any;
    const email = body?.email;
    if (!email || typeof email !== 'string') {
      return reply.status(400).send({ error: 'invalid_request' });
    }

    const client = await getDbPool().connect();
    try {
      const member = await upsertInvite(client, email);
      return reply.send(member);
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'invalid_email') {
        return reply.status(400).send({ error: 'invalid_request' });
      }
      return reply.status(500).send({ error: 'server_error' });
    } finally {
      client.release();
    }
  });

  fastify.patch('/api/admin/members/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireAdmin(request, reply)) return;

    const params = (request.params || {}) as any;
    const id = params?.id;
    if (!id || typeof id !== 'string') {
      return reply.status(400).send({ error: 'invalid_request' });
    }

    const body = (request.body || {}) as any;
    const is_active = body?.is_active;
    if (typeof is_active !== 'boolean') {
      return reply.status(400).send({ error: 'invalid_request' });
    }

    const client = await getDbPool().connect();
    try {
      const updated = await setMemberActive(client, id, is_active);
      if (!updated) {
        return reply.status(404).send({ error: 'not_found' });
      }
      return reply.send(updated);
    } finally {
      client.release();
    }
  });
}

