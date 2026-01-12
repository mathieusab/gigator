<!--
Sync Impact Report

- Version change: N/A (template) → 1.0.0
- Modified principles: Template placeholders →
  - I. Product-Driven MVP (No Scope Creep)
  - II. Validator Parity (Stack + UI)
  - III. Security & Privacy by Default (NON-NEGOTIABLE)
  - IV. Single Source of Truth (Supabase-first)
  - V. Quality Gates (Types, DX, and Tests)
- Added sections: Filled Technology & Workflow sections, Governance rules
- Removed sections: None
- Templates requiring updates:
  - ✅ updated: .specify/templates/plan-template.md
  - ✅ updated: .specify/templates/spec-template.md
  - ✅ updated: .specify/templates/tasks-template.md
- Follow-up TODOs:
	- TODO(RATIFICATION_DATE): Confirm original constitution adoption date.
-->

# Gigator Constitution

## Core Principles

### I. Product-Driven MVP (No Scope Creep)
- Features MUST map to the current PRD and/or an approved spec; avoid "nice-to-have" additions.
- Prefer the simplest viable implementation; defer optimizations and abstractions until needed.
- Keep UX simple and predictable; avoid novel flows unless required by the PRD.

### II. Validator Parity (Stack + UI)
- The web stack MUST remain aligned with the Validator patterns:
  - React + TypeScript + Vite
  - Routing via react-router-dom
  - Tailwind CSS with theme via CSS variables (e.g., --primary, --background) and darkMode=class
  - Icons via lucide-react; animations via tailwindcss-animate (when needed)
- UI theme MUST match Validator (colors, spacing, components); treat the PRD as the source of truth.

### III. Security & Privacy by Default (NON-NEGOTIABLE)
- All persisted data MUST be protected with Supabase RLS.
- Access MUST be restricted to authorized users (e.g., app_users.is_active = true).
- OAuth scopes MUST be minimal (MVP: gmail.readonly only); do not request broader scopes without explicit approval.
- Do not store OAuth access tokens or Gmail content in the database for MVP unless explicitly required and reviewed.
- Client-side secrets MUST NOT be shipped; public API keys (e.g., Maps) are allowed only with strict restrictions.

### IV. Single Source of Truth (Supabase-first)
- Supabase is the system of record for concerts and app authorization.
- Concert creation/editing is manual entry in-app (MVP); avoid hidden imports/sync jobs unless scoped and approved.
- Derived fields (lat/lng, denormalized display data) MUST be reproducible from canonical inputs (address/date/venue).
- Gmail is read-only and used for targeted conversation lookup by contact email; do not turn the app into a generic mailbox.

### V. Quality Gates (Types, DX, and Tests)
- TypeScript types MUST be kept accurate; avoid `any` unless justified and contained.
- User-visible errors MUST be handled gracefully (clear empty states, retry guidance, and safe fallbacks).
- Tests are required when changing security-sensitive behavior (auth, RLS policies, permissions) or when logic is non-trivial.
- Favor small PRs with clear acceptance criteria; keep the app responsive on mobile and usable as a PWA.

## Technology & Architecture Constraints

- Frontend MUST use React + TypeScript + Vite and follow Validator conventions.
- Auth MUST use Supabase Auth with Google as provider; use session.provider_token to call Google APIs when appropriate.
- Data MUST use Supabase (Postgres) via @supabase/supabase-js from the client (MVP approach).
- Gmail integration MUST be read-only (gmail.readonly) and scoped to contact conversations. By default the implementation SHOULD use a client-side approach using `session.provider_token` for direct, ephemeral reads. However, for security, privacy, or audit reasons a feature MAY instead use a minimal backend proxy.

### Proxy usage conditions (when a backend proxy is chosen)

- If a backend Gmail proxy is used, it MUST meet all of the following:
  - Use the minimal OAuth scope `gmail.readonly` only.
  - Do NOT persist OAuth access or refresh tokens in the database or long-term storage; tokens may be held only in process memory for short-lived exchanges.
  - Log proxy requests for audit purposes (redact message bodies if stored); logs must not contain raw OAuth tokens or full message content unless explicitly approved.
  - Implement rate-limiting, error handling, and clear 401/403 propagation to the client.
  - Centralize proxy code under `backend/src/proxy/gmail.ts` and expose a single, documented route (e.g., `/gmail/threads`) with contract tests.
  - Require PR review that documents the security rationale and includes tests validating behavior (mocked Gmail responses, auth/401 cases).

These constraints enable the project to choose the safest option per feature while preserving the Constitution's security and privacy intent.
- Environment variables expected:
  - VITE_SUPABASE_URL
  - VITE_SUPABASE_ANON_KEY
  - (If applicable) VITE_GOOGLE_MAPS_API_KEY (public, restricted)
- PWA is required (installable); offline data is not required but the app MUST degrade cleanly when offline.

## Development Workflow & Review Process

- Every feature MUST have a spec and tasks (via Spec Kit) unless explicitly waived for trivial changes.
- Reviews MUST verify:
	- Constitution compliance (principles above)
	- PRD alignment and no scope creep
	- Supabase RLS + authorization rules for any data access
	- Mobile responsiveness for List/Calendar/Map views
	- No client-shipped secrets; OAuth scopes minimized
- Prefer incremental delivery: complete one independently testable user story at a time.
- Keep dependencies minimal; introduce new libraries only with clear value.

## Governance
<!-- Example: Constitution supersedes all other practices; Amendments require documentation, approval, migration plan -->

- This constitution supersedes other conventions when there is a conflict.
- Amendments MUST be made via PR with:
  - a clear rationale,
  - impact analysis (including template updates in `.specify/templates/*`), and
  - any required migration steps.
- Versioning policy follows SemVer:
  - MAJOR: incompatible governance changes (removals or redefinitions)
  - MINOR: new principle/section or materially expanded guidance
  - PATCH: clarifications, wording, typos
- Every PR that changes product behavior SHOULD reference the PRD or an approved feature spec.

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE) | **Last Amended**: 2026-01-12
