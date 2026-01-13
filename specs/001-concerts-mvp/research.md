# Research: Concerts MVP (Phase 0)

This document records decisions that resolve technical unknowns for the Concerts MVP.

---

Decision: Use a minimal backend proxy for Gmail access

Rationale: The spec and constitution require avoiding exposing Gmail tokens to the client and enforcing audit/rate-limits. A tiny Node.js Express proxy enables secure token exchange, centralized logging, and minimal scope enforcement (gmail.readonly).

Alternatives considered:

- Client direct calls using `session.provider_token`: simpler but exposes tokens to the client and violates security guidance.
- Full OAuth server with refresh-token persistence: more robust but out of scope for MVP.

---

Decision: Use Google Maps JavaScript API for Map view (via `@googlemaps/js-api-loader`)

Rationale: Google Maps provides robust pin rendering and wide familiarity. For a few hundred pins performance is acceptable with clustering if needed later.

Alternatives considered:

- Leaflet + OpenStreetMap: avoids Google vendor lock-in and free tiles, but adds styling and potential rate-limit concerns for certain tile providers.

---

Decision: Geocoding remains manual/optional in MVP

Rationale: The PRD marks geocoding as optional. Manual entry of lat/lng is acceptable for MVP; automated geocoding deferred to later.

Alternatives considered:

- Integrate a geocoding API (Google Geocoding or Nominatim) now: increases scope and requires an API key.

---

Decision: Testing stack — Vitest + React Testing Library for frontend; supertest/jest for backend

Rationale: Lightweight test runner for Vite + modern TypeScript; supertest provides simple HTTP integration tests for the proxy.

Alternatives considered:

- Jest for frontend: heavier but familiar; chosen vitest for speed in Vite environment.

---

Decision: PWA support via Vite plugin + service worker stub (workbox optional)

Rationale: Requirement is installability and graceful offline degradation. A simple service worker registration and manifest satisfies acceptance criteria for MVP.

Alternatives considered:

- Full offline cache/queueing: out of scope for MVP.

---

Decision: Do not store Gmail message content or long-term OAuth tokens in the database for MVP

Rationale: Constitution forbids persistent Gmail content storage for MVP. The backend proxy will perform on-demand reads and return only necessary data to client; any tokens are ephemeral and stored only in proxy process memory where needed.

Alternatives considered:

- Store refresh tokens server-side for long-term mailbox access: rejected for MVP due to increased security review scope.

---

Summary: The research resolves open technical decisions in favor of a simple, secure architecture: React+Vite frontend, Supabase canonical datastore and auth, and a minimal Node.js Gmail proxy. This keeps scope tight and aligns with the constitution.
