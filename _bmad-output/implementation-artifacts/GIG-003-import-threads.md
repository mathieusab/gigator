# Story 1.3: Import threads job - importThreadsForAccount

Status: ready-for-dev
Story Key: GIG-003-import-threads

## Story
As a system processing a linked Gmail account,
I want a worker job that imports threads/messages idempotently and records run stats,
so that the inbox is populated reliably for downstream features.

## Acceptance Criteria
1) importThreadsForAccount(accountId, { maxResults? }) fetches threads/messages and upserts them idempotently (no duplicates on rerun).
2) gmail_import_runs row is created with imported/attempted counts and status recorded for the run.
3) Per-thread errors are logged/collected but do not abort the whole run; job completes best-effort.
4) maxResults (or similar limit) is respected when provided.

## Tasks / Subtasks
- [ ] Implement worker entrypoint to run importThreadsForAccount with configurable maxResults.
- [ ] Upsert threads and messages (idempotent) using existing schema in db/schema.sql; ensure indexes/constraints support idempotency.
- [ ] Record gmail_import_runs with imported and attempted counts; include error count if available.
- [ ] Handle per-thread errors gracefully (log/collect) while continuing the run; avoid failing the entire job for a single thread.
- [ ] Add integration tests with mocked Gmail API to verify upsert, counts, and resilience to per-thread failure.
- [ ] Add unit tests for mapping/parsing helpers if present.

## Developer Context and Guardrails
- Idempotency: key on gmail_thread_id/message_id; reruns must not duplicate rows.
- Reliability: add basic retry/backoff on Gmail fetch; avoid unbounded loops; respect maxResults and paging tokens.
- Observability: log structured messages for run start/end and per-thread failures; prepare metrics hooks for later (success/fail/imported counts).
- Security: do not log message bodies; keep tokens/secrets out of logs; sanitize upstream errors.
- Performance: batch DB writes when possible; avoid excessive round trips.

### Project Structure Notes
- Worker/service: app/backend/services/gmail_import.ts (or worker location) for import logic
- DB schema: db/schema.sql, db/migrations/
- Run tracking: gmail_import_runs table
- Tests: tests/integration/import_worker.test.js (or add new), unit helpers as needed

### References
- Ticket: docs/tickets.md (GIG-003)
- Acceptance: docs/acceptance_criteria_and_tests.md (Story 1.3)
- PRD reliability goals: _bmad-output/planning-artifacts/prd.md
- Architecture: ARCHITECTURE.md
- Sprint plan context: docs/sprint-plan.md

## Dev Agent Record
### Agent Model Used
GPT-5.1-Codex-Max

### Completion Notes
- Ready-for-dev with AC and tasks aligned to acceptance doc.
- Ensure idempotent upsert and run stats; keep logs/metrics clean of sensitive data.