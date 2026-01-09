# Story 3.1: Create opportunity - POST /api/opportunities

Status: ready-for-dev
Story Key: GIG-007-create-opportunity

## Story
As a user creating a new opportunity,
I want an API to persist an opportunity with required fields and defaults,
so that opportunities can be tracked and linked to threads/venues.

## Acceptance Criteria
1) POST /api/opportunities validates payload and requires title.
2) Returns 201 with persisted resource.
3) Persists fields: title, status (default), date, cachet, venue_id, owner_id, created_by, related_thread_id.

## Tasks / Subtasks
- [ ] Add POST /api/opportunities route/controller with validation (title required, optional fields typed) and default status.
- [ ] Persist fields listed above in DB; ensure schema supports defaults and foreign keys (venue_id, owner_id).
- [ ] Return 201 with created resource payload.
- [ ] Add integration tests: valid payload -> 201 + DB row; missing title -> 400.
- [ ] Update app/backend/openapi.yaml with request/response schemas and examples.

## Developer Context and Guardrails
- Validation: reject missing title; validate foreign keys; sanitize inputs.
- Defaults: define status default consistent with product taxonomy.
- Security: avoid mass assignment; whitelist fields; no sensitive data in responses.
- Logging: structured logs without PII beyond what is necessary.

### Project Structure Notes
- Routes/controllers: opportunities endpoint in app/backend/routes/... and app/backend/controllers/...
- DB: opportunities table in db/schema.sql; migrations if needed
- OpenAPI: app/backend/openapi.yaml
- Tests: tests/integration/opportunities.test.ts (or add) covering create and validation

### References
- Ticket: docs/tickets.md (GIG-007)
- Acceptance: docs/acceptance_criteria_and_tests.md (Story 3.1)
- PRD: _bmad-output/planning-artifacts/prd.md
- Architecture: ARCHITECTURE.md

## Dev Agent Record
### Agent Model Used
GPT-5.1-Codex-Max

### Completion Notes
- Ready-for-dev; ensure validation and default status align with product taxonomy and are tested.