# Story 2.2: Thread detail and create opportunity from thread

Status: ready-for-dev
Story Key: GIG-005-thread-detail-opportunity

## Story
As a user inspecting a Gmail thread,
I want to view its messages and participants and create an opportunity prefilled with this thread,
so that I can turn conversations into tracked opportunities quickly.

## Acceptance Criteria
1) GET /api/threads/:id returns messages (subject, body/snippet, sent_at) and participants derived from headers (From/To/CC).
2) UI/API supports creating an opportunity with related_thread_id prefilled from the thread detail.
3) Messages include sent_at populated (non-null).

## Tasks / Subtasks
- [ ] Add/extend GET /api/threads/:id to return messages with subject, snippet/body, sent_at, and participants (From/To/CC parsed).
- [ ] Add endpoint/flow to create opportunity from thread (reuse POST /api/opportunities) with related_thread_id set.
- [ ] Ensure validation: thread must exist; related_thread_id stored on opportunity.
- [ ] Add integration tests: thread detail returns messages with sent_at; create-opportunity-from-thread populates related_thread_id.
- [ ] Update app/backend/openapi.yaml with detail response schema and create-from-thread usage/example.

## Developer Context and Guardrails
- Data hygiene: strip/limit body/snippet size; avoid leaking headers beyond participants.
- Validation: 404 if thread not found; 400 if related_thread_id invalid on create.
- Activity logging: consider logging link creation if activity log exists.
- Performance: fetch messages efficiently; index related_thread_id on opportunities if not already.

### Project Structure Notes
- Routes/controllers: threads detail endpoint and opportunities create in app/backend/routes/... and app/backend/controllers/...
- DB: threads/messages tables; opportunities table for related_thread_id
- OpenAPI: app/backend/openapi.yaml
- Tests: tests/integration/threads_pagination.test.js (extend) and add create-from-thread integration test

### References
- Ticket: docs/tickets.md (GIG-005)
- Acceptance: docs/acceptance_criteria_and_tests.md (Story 2.2)
- PRD: _bmad-output/planning-artifacts/prd.md
- Architecture: ARCHITECTURE.md

## Dev Agent Record
### Agent Model Used
GPT-5.1-Codex-Max

### Completion Notes
- Ready-for-dev; ensure related_thread_id flow is covered by tests and OpenAPI.