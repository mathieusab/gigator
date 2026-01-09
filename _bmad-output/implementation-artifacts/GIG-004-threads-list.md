# Story 2.1: Threads list endpoint - GET /api/threads

Status: ready-for-dev
Story Key: GIG-004-threads-list

## Story
As a user viewing the inbox,
I want a paginated list of threads sorted by last_message_at,
so that I can scan recent conversations efficiently.

## Acceptance Criteria
1) GET /api/threads returns threads sorted by last_message_at desc.
2) Supports pagination (limit/offset or cursor) with defaults and bounds.
3) Each item includes at least: id, gmail_thread_id, subject, last_message_at.

## Tasks / Subtasks
- [ ] Add route/controller for GET /api/threads in app/backend/routes/auth_google.ts (or threads routes) returning sorted list.
- [ ] Implement query with pagination and sensible defaults/max limits to prevent abuse.
- [ ] Shape response items with required fields (id, gmail_thread_id, subject, last_message_at).
- [ ] Add integration test: seed 15 threads with varying last_message_at; expect top 10 sorted desc when limit=10.
- [ ] Add unit/contract tests for pagination params validation.
- [ ] Update app/backend/openapi.yaml with endpoint, params, and example response.

## Developer Context and Guardrails
- Sorting: primary sort last_message_at desc; stable tie-breaker (id) if needed.
- Validation: clamp limit; reject negative/oversized values; handle missing data gracefully.
- Security: no PII leakage beyond allowed fields; avoid including message bodies in list response.
- Performance: add index on last_message_at if not present; paginate in DB (no in-memory sort).

### Project Structure Notes
- Routes/controllers: app/backend/routes/... (threads endpoint), app/backend/controllers/...
- DB: threads table in db/schema.sql
- OpenAPI: app/backend/openapi.yaml
- Tests: tests/integration/threads_pagination.test.js (add/extend)

### References
- Ticket: docs/tickets.md (GIG-004)
- Acceptance: docs/acceptance_criteria_and_tests.md (Story 2.1)
- PRD: _bmad-output/planning-artifacts/prd.md
- Architecture: ARCHITECTURE.md

## Dev Agent Record
### Agent Model Used
GPT-5.1-Codex-Max

### Completion Notes
- Ready-for-dev; ensure pagination bounds and sorted order are enforced and tested.