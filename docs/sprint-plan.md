# Sprint Plan — Sprint 1 (Confirmed)

Status: Confirmed — dates and team availability set.

Related references
- Acceptance criteria & test scenarios: [`docs/acceptance_criteria_and_tests.md`](docs/acceptance_criteria_and_tests.md:1)  
- Architecture overview / ADRs: [`ARCHITECTURE.md`](ARCHITECTURE.md:1), [`_bmad/adrs/0001-gig-stack.md`](_bmad/adrs/0001-gig-stack.md:1)

Sprint goal
- Deliver a first end-to-end Gmail sync + inbox + create-opportunity flow so users can link a Google account, import threads, and create an opportunity from a thread. This enables early manual testing and validates the core import + inbox UX.

Sprint length (confirmed)
- 2 weeks (10 working days)
- Confirmed dates: 2026-01-12 → 2026-01-23

Team / assumptions (confirmed)
- Team: 3 engineers + 1 QA (confirmed)
- Assumed capacity: refine during planning with actual availability & holidays

Definition of Done (DoD)
- Feature implemented and reviewed in PR
- Automated integration tests covering the story's main scenarios (see acceptance doc)
- Relevant unit tests added for business logic
- ADR updated if security/storage decisions were impacted (e.g., token encryption)
- End-to-end basic manual verification performed (happy path)
- Release notes / change log entry (if applicable)

Sprint Backlog (finalize during planning)
Note: Estimates are preliminary (story points). Review and re-estimate with the team during sprint planning.

1) STORY-1.1 — Start OAuth endpoint (POST /api/sync/gmail/start)  
   - Short: Build endpoint that returns the OAuth consent URL.  
   - Acceptance: See [`docs/acceptance_criteria_and_tests.md`](docs/acceptance_criteria_and_tests.md:1) (Story 1.1)  
   - Estimate: 2 pts

2) STORY-1.2 — OAuth code exchange & persist tokens (GET /api/sync/gmail/callback)  
   - Short: Exchange code→tokens, persist access_token/refresh_token/expires_at in gmail_accounts, create gmail_import_runs entry. Do not return refresh_token to client.  
   - Acceptance: See Story 1.2 in acceptance doc.  
   - Estimate: 5 pts

3) STORY-1.3 — Import threads job (worker) + upsert into threads/messages  
   - Short: Implement importThreadsForAccount job with idempotent upsert behavior, record gmail_import_runs with imported/attempted.  
   - Acceptance: See Story 1.3.  
   - Estimate: 8 pts

4) STORY-7.1 — Make import worker robust (retry/backoff, job locking)  
   - Short: Add job locking (Redis/Bull or equivalent), retries with exponential backoff, metrics hooks.  
   - Acceptance: See EPIC 7.1.  
   - Estimate: 3 pts

5) STORY-2.1 — Paginated threads list endpoint (/api/threads)  
   - Short: API to list threads sorted by last_message_at with pagination, minimal fields for inbox.  
   - Acceptance: See Story 2.1.  
   - Estimate: 5 pts

6) STORY-2.2 — Thread detail + create opportunity from thread  
   - Short: GET /api/threads/:id returns messages + participants; add UI/endpoint option to create opportunity prefilled with related_thread_id.  
   - Acceptance: See Story 2.2.  
   - Estimate: 5 pts

7) STORY-3.1 — Create opportunity (POST /api/opportunities) — minimal MVP fields  
   - Short: Simple create opportunity API used by "Create from thread".  
   - Acceptance: See Story 3.1.  
   - Estimate: 3 pts

Sprint priority justification
- Stories 1.1 → 1.3 provide the plumbing to get data into the system (OAuth + import)
- 2.1 + 2.2 expose imported data to users and enable the main workflow (create opportunity from thread)
- 3.1 is required to persist opportunities created from threads
- Worker hardening (7.1) ensures reliability in CI and later QA

Sprint planning checklist (to run during planning meeting)
- Review and confirm estimates for each story (team-based).
- Confirm per-story owners and QA responsibilities.
- Confirm CI coverage expectations (which integration tests must be green before demo).
- Finalize acceptance criteria (copy from [`docs/acceptance_criteria_and_tests.md`](docs/acceptance_criteria_and_tests.md:1) into tickets).
- Create/assign tickets in the issue tracker and populate sprint board columns (To Do / In Progress / Review / Done).

Acceptance criteria & testing
- For each selected story, reference the matching section in [`docs/acceptance_criteria_and_tests.md`](docs/acceptance_criteria_and_tests.md:1).  
- Ensure at least one integration test and relevant unit tests per story (per the acceptance doc).  
- Add lightweight E2E scenarios for OAuth happy path and Import → Thread in Inbox.

Owners & assignments (TBD — assign in planning)
- Suggested initial split:
  - OAuth endpoints & token handling: Engineer A
  - Import worker & upsert logic: Engineer B
  - Threads endpoints / inbox: Engineer C
  - Create opportunity API + frontend hook: Engineer C / Engineer A
  - QA/test automation: QA lead (or rotating engineer)

Ceremonies (confirmed cadence)
- Sprint planning: 2–3 hours (first working day) — review backlog and finalize commitment
- Daily standup: 15 minutes, every day (time TBD)
- Mid-sprint sync (optional): 30 minutes (day 4–6) to unblock integration issues
- Sprint demo: 45 minutes (last working day)
- Retrospective: 45–60 minutes (after demo)

Risks & mitigations
- Token storage risk (PII/security): Mitigate by encrypting refresh_token in production and documenting in ADRs (`_bmad/adrs/`).  
- External dependency instability (Google API): Mock endpoints for CI (see tests/integration). Add retries and monitoring for worker.  
- Scope creep: Limit sprint to MVP stories above. Defer nonessential UI polish to subsequent sprints.

Definition of Done checklist per story (copy into PRs)
- [ ] Code compiled and linted
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] PR reviewed and merged
- [ ] Documentation updated (endpoints + ADRs if needed)
- [ ] Manual smoke test performed (happy path)

Next steps (action items) — immediate
1. Run sprint planning on 2026-01-12: refine estimates, assign owners, and finalize sprint backlog.  
2. Create sprint board and add the tickets for the 7 candidate stories.  
3. Confirm CI test coverage targets for the sprint (integration tests required).  
4. Start work on STORY-1.1 and STORY-1.2 on day 1.

Notes
- This plan uses the acceptance criteria document as the single source of truth for story definitions: [`docs/acceptance_criteria_and_tests.md`](docs/acceptance_criteria_and_tests.md:1).  
- Adjust estimates and included stories during planning as team confirms capacity.

Prepared by: SM assistant (confirmed)