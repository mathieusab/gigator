# backend

Purpose
- Backend API and integration layer for Gigator.

Suggested stack
- Node.js + TypeScript (Fastify or Express)
- Postgres for relational data
- Redis for cache/locks/queues

Core responsibilities
- REST/GraphQL API (opportunities, threads, contacts, venues, activity)
- Gmail OAuth sync & webhook handling
- LLM/AI proxy service (suggestions)
- Worker orchestration endpoints / admin tasks

How to start (MVP)
- Initialize a TypeScript Node project
- Add basic server with a health endpoint and /api/ping
