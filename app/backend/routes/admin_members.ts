// app/backend/routes/admin_members.ts
// Admin API for managing the app email allowlist (members list).
//
// Routes
// - GET   /api/admin/members
// - POST  /api/admin/members   { email }
// - PATCH /api/admin/members/:id { is_active }

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Pool } from 'pg';
import { verifyJwt } from '../lib/jwt';
import { listMembers, setMemberActive, upsertInvite } from '../lib/admin_members';

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

let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('missing_database_url');
    pool = new Pool({ connectionString: url });
  }
  return pool;
}

function requireAdmin(request: FastifyRequest, reply: FastifyReply): { email: string } | null {
  const token = getBearerToken(request) || getCookieToken(request);
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

    const client = await getPool().connect();
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

    const client = await getPool().connect();
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

    const client = await getPool().connect();
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
