# Feature Specification: Gigator — Concerts MVP

**Feature Branch**: `001-concerts-mvp`  
**Created**: 2026-01-12  
**Status**: Draft  
**Input**: Gigator PRD: centralize concerts, canonical datastore for storage (Supabase in PRD), Google sign-in, mailbox read-only lookup, List/Calendar/Map views, PWA

## Constraints (from Constitution)

- No scope creep beyond PRD/spec
- Maintain Validator parity (stack + UI theme)
- Security/privacy is non-negotiable (row-level security on the canonical datastore, least-privilege OAuth scopes)
- Mobile usability and PWA behavior must be considered

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in & access (Priority: P1)

As a band member, I want to sign in with Google and access the Gigator app so I can view and manage concerts.

Why this priority: Authentication is required for all other features and enforces access control per constitution.

Independent Test: Attempt sign-in with a Google account that is and is not present in `app_users`; verify access/denial.

Acceptance Scenarios:
1. Given a valid Google account that is active in `app_users`, When the user signs in, Then they land on the concerts list and see their name/avatar.
2. Given a valid Google account that is NOT active in `app_users`, When the user signs in, Then they see an access-denied message and cannot view concert data.

---

### User Story 2 - Create / Edit / View Concerts (Priority: P1)

As a user with access, I want to create, edit, and view concert records so the band has a single source of truth for dates and venues.

Why this priority: Core product value — centralizing booking information.

Independent Test: Create a concert, verify it appears in the "À venir" list and on calendar; edit and verify changes persist; delete and verify removal.

Acceptance Scenarios:
1. Given the user is authenticated and authorized, When they create a concert with date, venue_name, and city, Then the concert appears in the upcoming list ordered chronologically.
2. Given a concert exists, When the user edits its details, Then changes are reflected immediately in list, calendar, and map (if lat/lng present).
3. Given a concert is deleted, When the user returns to the list, Then the concert no longer appears.

---

### User Story 3 - Calendar view (Priority: P1)

As a user, I want a monthly calendar view that shows all concerts so I can quickly see schedule density and open dates.

Independent Test: Open calendar, navigate months, click an event to open detail preview.

Acceptance Scenarios:
1. Given multiple concerts on a day, When viewing the month, Then the day shows an indicator and clicking it shows a list/preview of events.
2. Given a concert event in the calendar, When the user clicks it, Then the app opens the concert details.

---

### User Story 4 - Map view (Priority: P2)

As a user, I want to see concerts on an interactive map so I can visualize locations and plan routing.

Independent Test: Open map view and verify pins for concerts with lat/lng; click a pin to show minimal preview (venue + date).

Acceptance Scenarios:
1. Given a concert has lat/lng, When viewing the map, Then a pin appears at the correct coordinates.
2. Given a pin is clicked, When the user clicks it, Then a small card shows `venue_name` and `date_start` and a link to the concert.

---

### User Story 5 - Gmail conversation lookup (Priority: P2)

As a user, I want to view Gmail threads related to a venue contact from a concert record so I can read historical communications.

Why this priority: Improves context for booking without building a full mail client.

Independent Test: From a concert detail, request conversation lookup by `venue_contact_email`; verify threads are returned (read-only).

Acceptance Scenarios:
1. Given a `venue_contact_email` is set, When the user requests conversation history, Then the app lists relevant Gmail threads (read-only) filtered by `from:`/`to:` query.
2. Given no matching threads, When the user requests history, Then the app shows an informative "no results" state.

---

### Edge Cases

- Concert missing lat/lng: Map should show a placeholder or skip the pin and provide an affordance to geocode the address.
- Gmail scope denied / token expired: Show clear error and guidance to re-authenticate (do not store tokens server-side in MVP).
- Corrupt or partial data: App must surface validation errors on create/edit and prevent saving invalid dates.
- Offline: App shows a clean offline state; editing is disabled or queued only if explicitly designed and approved (out of scope for MVP).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow users to sign in using Google OAuth and establish an application session.
- **FR-002**: The system MUST restrict access to users present and active in the `app_users` table.
- **FR-003**: The system MUST provide CRUD operations for `concerts` (create, read, update, delete) via the app UI.
- **FR-004**: The system MUST display concerts grouped into "À venir" (upcoming, chronological) and "Passés" (past, reverse chronological).
- **FR-005**: The system MUST render a monthly calendar showing concerts as events and allow navigation by month.
- **FR-006**: The system MUST render a map view with pins for concerts that have lat/lng coordinates; clicking a pin opens a minimal preview.
- **FR-007**: The system MUST allow a user to request external mailbox conversation threads related to a concert contact (read-only) using a minimal OAuth scope; the UI must present these threads as read-only.
- **FR-008**: The system MUST store concert metadata in the canonical datastore and enforce row-level access control policies that prevent unauthorized access.
- **FR-009**: The system MUST provide clear user-facing error messages and empty states for all primary flows.
- **FR-010**: The system MUST be responsive and function on mobile browsers and support being installable as a PWA.

### Key Entities

- **Concert**: Represents a scheduled or historical performance. Key attributes: `id`, `date_start`, `date_end`, `status`, `venue_name`, `city`, `country`, `address`, `lat`, `lng`, `venue_contact_name`, `venue_contact_email`, `notes`, `created_at`, `updated_at`.
- **AppUser**: Represents an authorized application user. Key attributes: `email`, `is_active`, `name`, `picture`, `last_login_at`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of testers with `app_users.is_active=true` can sign in and access the concerts list within 30 seconds of starting the flow.
- **SC-002**: Users can create and view a new concert end-to-end (create → list → calendar) in under 3 minutes (measured in manual acceptance tests).
- **SC-003**: For concerts with valid lat/lng, 95% of pins render in the correct geographic region on the map during acceptance testing.
- **SC-004**: Mailbox lookup returns relevant threads for at least 80% of seeded test contacts when `venue_contact_email` is present (during manual validation with a test mailbox).
- **SC-005**: The three main views (List, Calendar, Map) are usable on a mobile device without requiring horizontal scrolling and with targetable touch controls.

## Assumptions

- OAuth flow uses Supabase Auth with Google provider. Gmail API access SHALL be performed via a minimal backend proxy/service that handles token exchange or proxying of Gmail requests; the client MUST NOT call Gmail APIs directly with `session.provider_token` in production. This reduces token exposure and enables logging, rate-limiting and audit.
- Geocoding (address → lat/lng) is a manual/optional step in MVP; automatic geocoding is out-of-scope unless explicitly requested.
- No long-term storage of Gmail message content is required for MVP; the app performs on-demand reads only.
- Volume expectations are low (dozens to low hundreds of concerts), so initial performance targets are modest.

## Acceptance Test Checklist (for reviewers)

- [ ] Sign in with a Google account present in `app_users` and land on the concerts list.
- [ ] Attempt sign-in with a Google account not present in `app_users` and confirm access is denied.
- [ ] Create, edit, and delete a concert and verify propagation to List and Calendar views.
- [ ] Verify map shows pins for concerts with lat/lng and that pin previews open.
- [ ] From a concert with `venue_contact_email`, request Gmail threads and verify read-only threads are listed or a "no results" state is shown.

## Clarifications

### Session 2026-01-12

- Q: Should Gmail API calls be made directly from the client using `session.provider_token`, or proxied via a backend? → A: Option B — Backend proxy: use a small backend service to proxy/exchange Gmail requests (safer, audit/loggable, supports rate-limits). Integration updated to require backend proxy for mailbox access.

## Next Steps

1. Review spec and confirm assumptions (especially OAuth token usage for Gmail).  
2. If accepted, implement Phase 1 tasks: auth setup, Supabase schema & RLS, basic concerts CRUD and list view.  
3. After Phase 1, implement Calendar, Map, and Gmail lookup in subsequent increments.

