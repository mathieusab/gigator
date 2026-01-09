// app/backend/server.ts
// Minimal Fastify server wiring the route modules.

import Fastify from 'fastify';

import adminMembersRoutes from './routes/admin_members';
import authAppGoogleRoutes from './routes/auth_app_google';
import authGoogleRoutes from './routes/auth_google';
import meRoutes from './routes/me';
import venuesRoutes from './routes/venues';

export function buildServer() {
  const fastify = Fastify({ logger: true });

  fastify.register(meRoutes);
  fastify.register(adminMembersRoutes);
  fastify.register(authAppGoogleRoutes);
  fastify.register(authGoogleRoutes);
  fastify.register(venuesRoutes);

  fastify.get('/health', async () => ({ ok: true }));

  return fastify;
}

async function main() {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '0.0.0.0';

  const server = buildServer();
  await server.listen({ port, host });
}

if (require.main === module) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
