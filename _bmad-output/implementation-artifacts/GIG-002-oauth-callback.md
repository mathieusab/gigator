# Story 1.2: OAuth callback code exchange - GET /api/sync/gmail/callback

Status: ready-for-dev
Story Key: GIG-002-oauth-callback

## Story
As a user connecting my Gmail account,
I want the backend to exchange the OAuth code, validate state, and persist tokens safely,
so that sync can start without exposing secrets to the client.

## Acceptance Criteria
1) GET /api/sync/gmail/callback exchanges the code for tokens and persists access_token, refresh_token (if provided), and expires_at into gmail_accounts; creates a gmail_import_runs entry with status created.
2) Response is sanitized: no refresh_token in the payload; returns id, email, display_name, expires_at.
3) Error handling: missing/invalid code -> 400; token exchange failure -> 500 with safe message (no upstream body); malformed state -> 400.
4) State is validated/consumed one-shot via the state store; invalid or expired state is rejected.

## Tasks / Subtasks
- [ ] Add GET /api/sync/gmail/callback in app/backend/routes/auth_google.ts with clear 200/400/500 responses.
- [ ] Implement controller logic in app/backend/controllers/oauth.ts to call Google token endpoint, parse expires_in to expires_at, and persist tokens.
- [ ] Persist tokens in DB (gmail_accounts) and create gmail_import_runs row (status created) to kick off import later.
- [ ] Validate and consume state via app/backend/lib/oauth_state_store.ts; reject unknown/expired state.
- [ ] Sanitize responses and logs: never return or log refresh_token or access_token; map provider errors to safe messages.
- [ ] Update app/backend/openapi.yaml for the callback endpoint (200 example, 400/500 errors).
- [ ] Tests: integration happy path + state validation + error cases in tests/integration/oauth_callback_state.test.ts (or new file) and unit tests for token parsing as needed.

## Developer Context and Guardrails
- Security: never expose refresh_token; do not log provider bodies; reject invalid state; handle feature flag ENABLE_GMAIL_OAUTH_CALLBACK if present.
- Persistence: ensure gmail_accounts upsert is idempotent; store expires_at derived from expires_in; consider encryption of refresh_token in production (document in ADR if changed).
- Error contract: use { error, message } shape; 400 for bad input/state, 500 for upstream failures; avoid stack traces in responses.
- Dependencies: reuse existing HTTP client/config for Google endpoints; keep timeout/retry sane to avoid hanging callbacks.
- Tests: keep provider mocked; assert state is consumed one-shot; assert no refresh_token in response.

### Project Structure Notes
- Route: app/backend/routes/auth_google.ts
- Controller: app/backend/controllers/oauth.ts
- State store: app/backend/lib/oauth_state_store.ts
- DB schema: db/schema.sql (gmail_accounts), db/migrations/* if needed
- OpenAPI: app/backend/openapi.yaml
- Tests: tests/integration/oauth_callback_state.test.ts (and related unit tests)

### References
- Ticket: docs/tickets.md (GIG-002)
- Acceptance: docs/acceptance_criteria_and_tests.md (Story 1.2)
- PRD: _bmad-output/planning-artifacts/prd.md
- Architecture: ARCHITECTURE.md
- OAuth start story for context: _bmad-output/implementation-artifacts/GIG-001-oauth-start.md

## Dev Agent Record
### Agent Model Used
GPT-5.1-Codex-Max

### Completion Notes
- Story marked ready-for-dev with AC and tasks aligned to the acceptance doc.
- Ensure state validation is enforced and refresh_token is never surfaced.
- OpenAPI and tests must stay aligned with implementation and error contract.