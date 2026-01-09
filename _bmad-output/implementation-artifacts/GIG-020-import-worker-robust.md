# Story 7.1: Robust Gmail import worker - retries, locking, metrics

Status: ready-for-dev
Story Key: GIG-020-import-worker-robust

## Story
As a system operator relying on Gmail import,
I want the import worker to be robust with retries, locking, and metrics,
so that imports are reliable, non-duplicated, and observable.

## Acceptance Criteria
1) Worker is idempotent and retryable with exponential backoff for transient failures.
2) Job locking prevents duplicate concurrent runs for the same account (Redis/Bull or equivalent) with TTL.
3) Metrics emitted for success/fail counts and queue depth/backlog as applicable.
4) Errors are logged with structured data; sensitive data (tokens/bodies) are not logged.

## Tasks / Subtasks
- [ ] Add locking around importThreadsForAccount (Redis key or queue lock) with TTL to avoid duplicate concurrent runs.
- [ ] Implement retry/backoff strategy for transient Gmail/IO errors with capped attempts.
- [ ] Emit metrics hooks (success/fail/imported/attempted, queue depth) compatible with Prometheus or existing logger.
- [ ] Ensure idempotent processing remains intact (no double inserts on retries).
- [ ] Add integration test with mocked Gmail API: simulate intermittent failure then success, verify retries and metrics/logs; test lock prevents double run.
- [ ] Document operational expectations (Redis required when configured) in code comments or README if needed.

## Developer Context and Guardrails
- Locking: fail closed if REDIS_URL configured but Redis unavailable; log actionable error.
- Backoff: exponential with max attempts to avoid infinite retry loops; include jitter to reduce thundering herd.
- Metrics: keep labels small; avoid high cardinality; ensure zero secrets in logs/metrics.
- Resilience: handle partial success; ensure run status recorded even on failure.

### Project Structure Notes
- Worker/queue: app/backend/services/gmail_import.ts (or worker) plus queue/lock helper in app/backend/lib/
- Redis/queue config: package.json deps include redis; ensure typings.
- Tests: tests/integration/import_worker.test.js (extend) and unit tests for retry/lock helpers
- Metrics: expose via existing metrics endpoint or logger hooks

### References
- Ticket: docs/tickets.md (GIG-020)
- Acceptance: docs/acceptance_criteria_and_tests.md (EPIC 7.1 Worker Gmail import robuste)
- PRD reliability: _bmad-output/planning-artifacts/prd.md
- Architecture: ARCHITECTURE.md
- Related import logic: _bmad-output/implementation-artifacts/GIG-003-import-threads.md

## Dev Agent Record
### Agent Model Used
GPT-5.1-Codex-Max

### Completion Notes
- Ready-for-dev; focus on lock + retry/backoff correctness and metrics without leaking secrets.