# High-level Architecture — Gigator

Status: Draft

References
- Design inputs (personas, tasks, KPIs): [`_bmad-inputs/design-inputs.md`](_bmad-inputs/design-inputs.md:1)
- Wireframes (Excalidraw): [`_bmad-output/excalidraw-diagrams/wireframe-2026-01-07T22-00-20Z.excalidraw`](_bmad-output/excalidraw-diagrams/wireframe-2026-01-07T22-00-20Z.excalidraw:1)
- Theme / visual constraints: [`_bmad-output/excalidraw-diagrams/theme.json`](_bmad-output/excalidraw-diagrams/theme.json:1)
- Current repository scan: top-level app folder is empty (`[`app/`]`(app/:1)) — implement scaffolding under `./app` or `./src`

Goals & constraints (short)
- Primary flows: Inbox triage (Gmail threads), Opportunité detail, Composer (AI-assisted drafting + anti-duplicate check), Dashboard (KPIs + calendar + map), Contacts & Salles as linked sources of truth.
- Non-functional: responsive (mobile + desktop), AA accessibility, monochrome theme, fast load (<3s).
- Integrations: Gmail (threads + send), Maps (deep-links/embeds), LLM/AI assistant for drafts, OAuth for auth.

Core components (logical)
1. Frontend (web app)
   - Tech: React + TypeScript (or Next.js) — single codebase for mobile/desktop responsive UI.
   - Responsibilities:
     - Render screens in wireframes, manage routing, client-side state.
     - Compose UI for Inbox, Opportunités, Composer, Contacts, Salles, Dashboard.
     - Connect to backend via REST/GraphQL; handle optimistic updates and accessibility.
   - Assets & deliverables:
     - Excalidraw exports and PNG/SVG for designs: see [`_bmad-output/excalidraw-diagrams/wireframe-2026-01-07T22-00-20Z.excalidraw`](_bmad-output/excalidraw-diagrams/wireframe-2026-01-07T22-00-20Z.excalidraw:1)
2. Backend API
   - Tech choices: Node (Fastify/Express) or Python (FastAPI). Provide REST or GraphQL endpoints.
   - Responsibilities:
     - Domain services for Opportunities, Contacts, Venues, Threads, Users, Activity logs.
     - Authentication & authorization (OAuth2 + Google sign-in for Gmail sync).
     - Rate-limited integrations to Gmail and AI providers; worker orchestration.
3. Data storage
   - Primary DB: Supabase (managed PostgreSQL) — use Supabase for relational data, authentication (Supabase Auth), row-level security and realtime where useful. Supabase also provides built-in object storage for attachments.
   - Cache / locks / queues: Redis for caching, short TTL locks and job queues (recommended for BullMQ). For light workloads, Supabase Realtime or Edge Functions can be considered, but Redis is recommended for worker reliability.
   - Attachments/storage: Supabase Storage (S3-compatible) — use Supabase storage buckets for exported files and attachments, or connect an external S3-compatible store if required.
4. Integration & sync layer
   - Gmail sync:
     - OAuth2 flow for Google account scopes (Gmail read + send).
     - Polling / push notifications (watch API + webhook) to import threads into the domain as Thread records.
   - Maps:
     - External map links or embed provider (Google Maps or Leaflet with tile provider).
   - AI Assistant:
     - Calls to an LLM endpoint (OpenAI, or internal provider); responses cached and stored as suggestions.
5. Background workers
   - Responsibilities:
     - Long-running tasks: Mail sync, AI suggestion generation, deduplication checks, exports (PNG/SVG), notifications.
   - Tech: worker process (BullMQ, Sidekiq pattern) backed by Redis.
6. Observability & infra
   - Logging: structured logs (JSON) aggregated (e.g., CloudWatch / ELK / Loki).
   - Metrics: Prometheus/Grafana for key service metrics (sync latency, queue depth).
   - Tracing: OpenTelemetry to trace mail → suggestion → send.
   - Security: secrets in Vault/Secrets Manager; TLS; data encryption at rest/in transit.

Data model skeleton (core entities)
- User { id, google_id, email, name, role, settings }
- Thread { id, gmail_thread_id, subject, last_message_at, raw_payload, source_account_id }
- Opportunity { id, title, status, date, cachet, venue_id, owner_id, created_by, related_thread_id }
- Contact { id, name, email, phone, preferred_contact_method, linked_venues[] }
- Venue (Salle) { id, name, address, geo, capacity, linked_contacts[] }
- ActivityLog { id, actor_id, action_type, target_type, target_id, metadata, timestamp }
Notes: define indices for gmail ids and duplicate detection keys.

Anti-duplicate / Lock pattern
- When composing, run dedupe check via worker:
  - Check recent sends and thread history (ActivityLog + Thread).
  - If recent send found, return Lock object { locked_by, reason, evidence } and UI shows modal with proof (as in wireframe).
- Implement short TTL locks in Redis; record evidence in ActivityLog.

API surface (examples)
- GET /api/opportunities?filter...
- GET /api/opportunities/:id
- POST /api/opportunities
- POST /api/compose (create draft + request AI suggestion)
- POST /api/sync/gmail/start (init OAuth + start watch)
- POST /api/ai/suggest (request suggestion; should be idempotent / rate-limited)

Security, privacy & compliance
- Google OAuth scopes limited to minimum (gmail.readonly + gmail.send if required).
- Personal data minimization: store only necessary contact data; document retention policy.
- GDPR: export/removal endpoints for user data; encrypted DB backups.
- Audit trail: every send / assignment logged in ActivityLog.

Infra & deployment (recommended MVP)
- Containerized services (Docker) + orchestration (ECS / Kubernetes / Cloud Run).
- Infrastructure as code: Terraform modules for DB, Redis, object store, IAM.
- CI/CD: GitHub Actions with:
  - Lint → Unit tests → Build → Integration tests → Deploy to staging.
  - Release pipeline for production.
- Hosting choices: low-effort MVP → Vercel (frontend) + Cloud Run or DigitalOcean App Platform + managed Postgres.

Operational concerns
- Rate limits: Gmail + LLM providers — implement exponential backoff and queueing.
- Observability: set alert for queue backlog, sync failures, auth expirations.
- Data migrations and schema versioning (use migrations tool like Flyway / TypeORM migrations).

Decisions to record (ADR)
- ADR-001: Tech stack for frontend (React + TypeScript) — record pros/cons.
- ADR-002: Backend language & framework.
- ADR-003: Choice of LLM provider vs on-prem model.
- ADR-004: Gmail integration strategy (watch/webhook vs periodic polling).
Create ADRs in `_bmad/` as `adrs/` or `docs/adr/` (recommended).

Next steps (actionable)
1. Create project skeleton:
   - frontend scaffold: `./app/frontend` (React + TypeScript)
   - backend scaffold: `./app/backend`
   - workers: `./app/worker`
   - infra: `./infra` with Terraform templates
2. Produce detailed component diagram (Excalidraw) and add to repo: link to wireframes above.
3. Draft initial ADRs in `_bmad/adrs/`.
4. Implement minimal Gmail sync flow (OAuth consent + thread import) as first integration.
5. Implement basic opportunity CRUD and UI list to validate data model.

Where to store this document
- Root `ARCHITECTURE.md` (this file).
- Add design diagrams to [`_bmad-output/excalidraw-diagrams/wireframe-2026-01-07T22-00-20Z.excalidraw`](_bmad-output/excalidraw-diagrams/wireframe-2026-01-07T22-00-20Z.excalidraw:1).
- Create ADRs in `_bmad/adrs/` and link from this file.

Contacts / Stakeholders to confirm
- Product owner / author: referenced in design inputs: [`_bmad-inputs/design-inputs.md`](_bmad-inputs/design-inputs.md:1)
- Dev lead: confirm preferred stack and infra budget.

Acceptance criteria for architecture deliverable
- ARCHITECTURE.md with component responsibilities and decisions (this file).
- At least one ADR file for core decisions.
- Excalidraw diagram for component interactions (saved in `_bmad-output/excalidraw-diagrams/`).
- A minimal repo scaffold (frontend+backend+worker) and CI skeleton (GitHub Actions).

If you approve this direction I will:
- Create `./_bmad/adrs/0001-gig-stack.md` (ADR for stack) and
- Create a repo scaffold proposal (file list + minimal README).