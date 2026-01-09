# ADR-0001 — Gigator: Initial tech stack decision

Status: Proposed
Date: 2026-01-07
Authors: Mathieu (product), Architect (draft)

Context
- Wireframes, personas and flows documented in [`_bmad-inputs/design-inputs.md`](_bmad-inputs/design-inputs.md:1) and UI wireframes in [`_bmad-output/excalidraw-diagrams/wireframe-2026-01-07T22-00-20Z.excalidraw`](_bmad-output/excalidraw-diagrams/wireframe-2026-01-07T22-00-20Z.excalidraw:1).
- Requirements: responsive web app (mobile + desktop), Gmail thread sync, AI-assisted composer, anti-duplicate locking, KPI dashboard, maps, fast load and AA accessibility.
- Goal for ADR: choose an initial stack for MVP to speed implementation while keeping options open for scaling.

Decision
1. Frontend
   - React + TypeScript with Next.js for server-side rendering (optional) and routes.
   - Rationale: single codebase for desktop + mobile, strong ecosystem (accessibility, routing, image/export support), good DX for design-to-code workflow.
2. Backend
   - Node.js with Fastify (or Express) + TypeScript.
   - Rationale: same language across stack reduces context switching; Fastify provides high-performance HTTP and plugin ecosystem for auth and validation.
3. Data storage
   - Postgres as primary relational DB.
   - Redis for caching, short TTL locks (anti-dup behavior) and queue broker for workers.
4. Workers / background jobs
   - BullMQ (Redis-backed) or similar for job queues.
   - Rationale: reliable delayed jobs, retry semantics, visibility into queue.
5. AI integration
   - Initially use external LLM API (e.g., OpenAI / provider chosen by PO). Abstract provider behind a service interface to allow swapping to on-prem or other APIs later.
6. Gmail integration
   - Google OAuth2 for account permissions.
   - Use Gmail Watch API / webhooks where possible, fallback to polling for reliability.
7. Storage for attachments/exports
   - S3-compatible storage (AWS S3 or compatible).
8. Infra & deployment
   - Containerized services (Docker).
   - Use managed Postgres and Redis for MVP (cloud provider), deploy backend & workers to Cloud Run / ECS / Cloud Run depending on budget. Host frontend on Vercel or similar for Next.js.
9. CI/CD
   - GitHub Actions for lint/tests/build/deploy pipeline.

Alternatives considered (short)
- Backend in Python (FastAPI): better async and data tooling, but adds language context switching for small team.
- Using a no-code integration platform for Gmail: faster initial sync but less control for anti-dup / evidence logging.
- On-prem LLM or self-hosted models: higher infra cost / ops; deferred until stable usage patterns.

Consequences
- Pros:
  - Fast iteration with a JS/TS full-stack.
  - Strong ecosystem for UI, testing and deployment.
  - Easier to onboard engineers with mainstream choices.
- Cons:
  - Potential vendor lock if AI provider chosen without abstraction.
  - Node.js scaling concerns can be addressed with stateless services + managed infra.
- Risk mitigations:
  - Abstract external providers behind service interfaces + use feature flags for switching providers.
  - Implement quota-aware request patterns and queueing for LLM/Gmail calls.

Next steps
- Record ADR in repo (this file).
- Create complementary ADRs:
  - ADR-0002: Database schema & migration strategy
  - ADR-0003: Gmail integration strategy (watch vs polling)
  - ADR-0004: LLM provider selection criteria
- Create repo scaffold: frontend/backend/worker/infra.
- Implement minimal PoC: Google OAuth → import small set of threads → create Opportunity records.

References
- Architecture overview: [`ARCHITECTURE.md`](ARCHITECTURE.md:1)
- Wireframes & theme: [`_bmad-output/excalidraw-diagrams/wireframe-2026-01-07T22-00-20Z.excalidraw`](_bmad-output/excalidraw-diagrams/wireframe-2026-01-07T22-00-20Z.excalidraw:1), [`_bmad-output/excalidraw-diagrams/theme.json`](_bmad-output/excalidraw-diagrams/theme.json:1)