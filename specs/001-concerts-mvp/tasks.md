---
description: 'Generated tasks for Concerts MVP'
---

# Tasks: Concerts MVP

**Input**: Design documents from `/specs/001-concerts-mvp/`

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Create frontend scaffold (Vite React + TypeScript) with `frontend/package.json` and `frontend/vite.config.ts`
- [x] T002 Create backend scaffold (Node.js + Express) with `backend/package.json` and `backend/src/index.ts`
- [x] T003 [P] Configure repo tooling: add `.eslintrc.js`, `.prettierrc`, and `pnpm-workspace.yaml`

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T004 Create database schema SQL at `specs/001-concerts-mvp/sql/init.sql` (tables: `app_users`, `concerts`)
- [x] T005 [P] Add `specs/001-concerts-mvp/sql/seed_app_users.sql` to seed example `app_users` for acceptance tests
- [x] T006 [P] Add RLS policy SQL at `specs/001-concerts-mvp/sql/rls.sql` implementing `is_active` and `auth.uid()` checks
- [x] T007 [P] Implement Gmail proxy skeleton in `backend/src/proxy/gmail.ts` and router `backend/src/routes/gmail.ts`
- [x] T008 Create backend environment example at `backend/.env.example` documenting `GMAIL_PROXY_CLIENT_ID` and `GMAIL_PROXY_CLIENT_SECRET`
- [x] T009 Configure frontend Supabase client at `frontend/src/lib/supabaseClient.ts` (uses `VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY`)

- [x] T035 [P] Add RLS integration tests: `specs/001-concerts-mvp/tests/rls/test_concerts_rls.spec.ts` (validate select/insert/update/delete under simulated `auth.uid()` contexts)

---

## Phase 3: User Story 1 - Sign in & access (Priority: P1) 🎯 MVP

**Goal**: Allow Google sign-in and enforce access only to `app_users.is_active=true`.

**Independent Test**: Sign in with an active `app_users` account — lands on concerts list; sign in with inactive/nonexistent account — see access-denied.

- [x] T010 [P] [US1] Create `frontend/src/pages/Login.tsx` with sign-in entrypoint
- [x] T011 [US1] Implement `frontend/src/components/GoogleSignInButton.tsx` that triggers Supabase OAuth
- [x] T012 [US1] Implement `frontend/src/lib/supabaseAuth.ts` helper (session handling, redirect)
- [x] T013 [P] [US1] Add `specs/001-concerts-mvp/sql/seed_app_users.sql` entry for CI/manual acceptance (ensure `is_active=true` sample)
- [x] T014 [US1] Add integration test `frontend/tests/integration/test_auth.spec.ts` verifying sign-in happy/sad paths
- [x] T015 [US1] Create `frontend/src/pages/AccessDenied.tsx` and wire redirect for unauthorized users

---

## Phase 4: User Story 2 - Create / Edit / View Concerts (Priority: P1)

**Goal**: Provide CRUD for `concerts` and show upcoming / past groupings.

**Independent Test**: Create a concert → appears in upcoming list and calendar; edit persists; delete removes it.

- [x] T016 [P] [US2] Create `frontend/src/services/concerts.ts` implementing CRUD via `@supabase/supabase-js`
- [x] T017 [P] [US2] Implement `frontend/src/pages/ConcertList.tsx` (group upcoming / past)
- [x] T018 [P] [US2] Implement `frontend/src/components/ConcertForm.tsx` and `frontend/src/pages/ConcertEdit.tsx` for create/edit
- [x] T019 [US2] [US2] Add integration test `frontend/tests/integration/test_concerts.spec.ts` covering create → list → edit → delete
- [x] T020 [US2] [P] Implement chronological ordering and the `À venir` / `Passés` UI in `frontend/src/components/ConcertListItem.tsx`

---

## Phase 5: User Story 3 - Calendar view (Priority: P1)

**Goal**: Monthly calendar showing concerts; clicking an event opens details.

**Independent Test**: Open calendar, navigate months, click event to preview details.

- [x] T021 [P] [US3] Implement `frontend/src/components/CalendarView.tsx` (month navigation + event indicators)
- [x] T022 [P] [US3] Add `frontend/src/pages/CalendarPage.tsx` that uses `CalendarView`
- [x] T023 [US3] Add integration test `frontend/tests/integration/test_calendar.spec.ts` for navigation and event click behavior

---

## Phase 6: User Story 4 - Map view (Priority: P2)

**Goal**: Interactive map with pins for concerts that have `lat`/`lng`.

**Independent Test**: Open map → pins for concerts with coordinates render; clicking pin shows `venue_name` + `date_start` and link to details.

- [ ] T024 [P] [US4] Implement `frontend/src/components/MapView.tsx` using `@googlemaps/js-api-loader` and render pins
- [ ] T025 [P] [US4] Add `frontend/src/pages/MapPage.tsx` and route to it
- [ ] T026 [P] [US4] Add integration test `frontend/tests/integration/test_map.spec.ts` that stubs map loader and checks pin rendering logic
- [x] T024 [P] [US4] Implement `frontend/src/components/MapView.tsx` using `@googlemaps/js-api-loader` and render pins
- [x] T025 [P] [US4] Add `frontend/src/pages/MapPage.tsx` and route to it
- [x] T026 [P] [US4] Add integration test `frontend/tests/integration/test_map.spec.ts` that stubs map loader and checks pin rendering logic

---

## Phase 7: User Story 5 - Gmail conversation lookup (Priority: P2)

**Goal**: From a concert detail, request Gmail threads for `venue_contact_email` via a backend proxy (read-only).

**Independent Test**: From a concert detail, request threads → backend returns list OR an empty "no results" state; errors surfaced clearly.

- [x] T027 [P] [US5] Implement backend route `backend/src/routes/gmail.ts` that proxies `/gmail/threads` per `specs/001-concerts-mvp/contracts/openapi.yaml`
- [x] T028 [P] [US5] Implement backend Gmail client in `backend/src/proxy/gmail.ts` (uses env vars `GMAIL_PROXY_CLIENT_ID/SECRET`)
- [x] T029 [P] [US5] Implement `frontend/src/services/gmailProxy.ts` to call the backend `/gmail/threads?email=` endpoint
- [x] T030 [US5] [US5] Add integration test `backend/tests/integration/test_gmail_proxy.spec.ts` that mocks Gmail responses (verify happy / no-results / 401 paths)
- [x] T031 [US5] [P] Implement `frontend/src/components/GmailThreads.tsx` that shows threads, empty state, and error handling

---

## Final Phase: Polish & Cross-Cutting Concerns

- [X] T032 [P] Documentation: create `specs/001-concerts-mvp/README.md` with quickstart and acceptance steps
- [X] T033 [P] Code formatting & linting run across `frontend/` and `backend/` (apply `.eslintrc.js` and `.prettierrc`)
- [X] T034 Run `specs/001-concerts-mvp/quickstart.md` validation and ensure SQL in `specs/001-concerts-mvp/sql/` applies cleanly

- [X] T036 [P] Implement PWA manifest and service worker: `frontend/public/manifest.json` and `frontend/src/service-worker.ts`; add acceptance test `frontend/tests/pwa/test_installability.spec.ts`
- [X] T037 [P] Add performance and network-simulation tests: Lighthouse script and `scripts/perf/run_lighthouse.sh` to validate SC-001 and page load budgets under throttled networks
- [X] T038 [P] Add Gmail error-handling tests: `backend/tests/integration/test_gmail_proxy_errors.spec.ts` and `frontend/tests/integration/test_gmail_error_states.spec.ts` (covers 401, no-results, token-expiry guidance)

---

## Dependencies & Execution Order

- Setup (Phase 1) → Foundational (Phase 2) MUST complete before User Story phases.
- User Stories (US1, US2, US3) are Priority P1 and should be implemented in Phase 3–5; US4 and US5 are P2 and follow.
- Many tasks marked `[P]` can be worked in parallel (linting, client config, some services, model migrations, UI components across pages).

## Parallel execution examples

- Implement `T024` (`frontend/src/components/MapView.tsx`) and `T021` (`frontend/src/components/CalendarView.tsx`) in parallel.
- Run integration tests `frontend/tests/integration/test_auth.spec.ts` and `frontend/tests/integration/test_concerts.spec.ts` in parallel once foundational DB seeds and Supabase client are configured.

## Implementation strategy

- MVP first: deliver Phase 1 + Phase 2 + Phase 3 (User Story 1) as the minimal demoable increment.
- Incrementally add US2 and US3 next (both P1) then US4 and US5 (P2).

---

Generated-by: speckit.tasks
