// app/backend/server.ts
// Minimal Fastify server wiring the route modules.

import Fastify from 'fastify';

import adminMembersRoutes from './routes/admin_members';
import authAppGoogleRoutes from './routes/auth_app_google';
import authGoogleRoutes from './routes/auth_google';
import contactVenuesRoutes from './routes/contact_venues';
import contactsRoutes from './routes/contacts';
import meRoutes from './routes/me';
import opportunitiesRoutes from './routes/opportunities';
import searchRoutes from './routes/search';
import venuesRoutes from './routes/venues';

export function buildServer() {
  const fastify = Fastify({ logger: true });

  // Friendly landing for the API base URL.
  fastify.get('/', async () => ({ ok: true, service: 'gigator-backend', health: '/health' }));

  // Avoid noisy 404s when opened in a browser.
  fastify.get('/favicon.ico', async (_request, reply) => reply.status(204).send());

  fastify.register(meRoutes);
  fastify.register(adminMembersRoutes);
  fastify.register(authAppGoogleRoutes);
  fastify.register(authGoogleRoutes);
  fastify.register(contactVenuesRoutes);
  fastify.register(contactsRoutes);
  fastify.register(opportunitiesRoutes);
  fastify.register(searchRoutes);
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
