# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript (ES2022 target) for frontend and Node.js 18+ for the small backend proxy
**Primary Dependencies**: React, Vite, @supabase/supabase-js, react-router-dom, Tailwind CSS, lucide-react, google-maps (or `@googlemaps/js-api-loader`), node-fetch/express for backend proxy
**Storage**: Supabase (Postgres) as the canonical datastore (concerts, app_users)
**Testing**: Vitest + React Testing Library for frontend; supertest / jest for backend proxy integration tests
**Target Platform**: Web (desktop + mobile browsers) with PWA installability; minimal Node.js backend for Gmail proxy
**Project Type**: Web application (frontend + small backend proxy)
**Performance Goals**: Modest targets for MVP — pages should load < 1s on 3G-fast simulated mobile; map rendering performant for up to a few hundred pins
**Constraints**: Must enforce Supabase RLS for all persisted data; OAuth scopes minimal (gmail.readonly); do not store OAuth tokens server-side for MVP except transiently in the proxy process if absolutely required
**Scale/Scope**: Low initial volume (dozens → low hundreds of concerts); architecture should be horizontally scalable but optimized for simplicity in MVP

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [ ] Scope matches PRD/spec; no "nice-to-have" additions
- [ ] UI/stack stays aligned with Validator (React+TS+Vite, Tailwind tokens, routing)
- [ ] Security/privacy covered (RLS, authorized users only, minimal OAuth scopes)
- [ ] No client-shipped secrets; public API keys are restricted
- [ ] Mobile usability + PWA requirements considered for UX changes

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: Web application split into `frontend/` and `backend/`.

- `frontend/`: React + TypeScript + Vite app that implements List, Calendar, Map, and Gmail lookup UI. Uses `@supabase/supabase-js` to access Supabase for auth and data. Implements PWA manifest and service worker placeholder.
- `backend/`: Minimal Node.js + Express service to proxy Gmail API requests and perform token exchange where needed. Keeps Gmail access off the client and enables logging/rate-limiting. Backend is intentionally small and only added because Gmail proxy is required by the spec/constitution.

Reference paths (will be created/used during implementation):

```
frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

backend/
├── src/
│   └── proxy/
└── tests/
```

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
