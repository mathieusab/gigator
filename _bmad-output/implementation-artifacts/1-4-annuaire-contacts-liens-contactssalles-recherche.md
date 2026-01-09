# Story 1.4: Annuaire contacts + liens contacts↔salles + recherche

Status: review

## Story

As a utilisateur,
I want gérer des contacts et les lier à des salles, et rechercher rapidement,
so that je puisse retrouver les bons interlocuteurs sans friction.

## Acceptance Criteria

1. **Given** je suis connecté
   **When** je crée un contact avec des canaux (email/téléphone/Instagram) et des notes
   **Then** le contact est visible et éditable

2. **Given** un contact et une salle existent
   **When** je lie le contact à la salle
   **Then** l’association est visible côté contact et côté salle

3. **Given** je suis sur une vue liste (annuaire/pipeline)
   **When** je recherche par mot-clé
   **Then** je vois des résultats pertinents sur salles/opportunités/contacts

### Clarifications / Guardrails (pour éviter erreurs d’implémentation)

- **Dépendance**: cette story suppose que la “salle/venue” existe (Story 1.3). Si la table `venues` n’est pas encore introduite, traiter d’abord 1.3.
- **Champs MVP “Contact” (source of truth)**:
  - `name` (obligatoire)
  - `email` (optionnel)
  - `phone` (optionnel)
  - `instagram` (optionnel)
  - `notes` (optionnel)
  - timestamps `created_at` / `updated_at`
  Objectif: **un seul enregistrement** par contact, pas de modélisation multi-canaux avancée au MVP.
- **Liens contacts↔salles**: utiliser une table de jointure (ex: `contact_venues`) avec contrainte d’unicité `(contact_id, venue_id)`.
- **Recherche**:
  - MVP acceptable: recherche “contains” case-insensitive (`ILIKE`) sur `name` (contacts + venues) et `title` (opportunities), avec un param `q`.
  - Ne pas sur-concevoir (pas de scoring, pas d’index full-text complexe au MVP) mais garder des indexes simples si nécessaire.
- **Auth**: toutes les routes doivent exiger une session (JWT) comme `/api/me` (réutiliser `getSessionToken()` + `verifyJwt()` + `APP_JWT_SECRET`).
- **UX (rappel)**: mobile-first, feedback immédiat, un CTA principal par écran; pas d’échec silencieux.

## Tasks / Subtasks

- [x] DB: introduire tables “contacts” + “contact_venues” (AC #1-#2)
  - [x] Ajouter migration `db/migrations/0005_create_contacts_and_links.sql` (ou prochain numéro) avec:
    - [x] `contacts` (id uuid, name, email, phone, instagram, notes, created_at, updated_at)
    - [x] `contact_venues` (id uuid, contact_id, venue_id, created_at) + UNIQUE(contact_id, venue_id)
  - [x] Mettre à jour `db/schema.sql` pour refléter ces tables

- [x] Backend: CRUD contacts (AC #1)
  - [x] DB helpers `app/backend/lib/contacts.ts` (pattern `DbClient`)
    - [x] `createContact(db, payload)`
    - [x] `listContacts(db, { q? })`
    - [x] `getContactById(db, id)`
    - [x] `updateContact(db, id, patch)`
  - [x] Routes `app/backend/routes/contacts.ts`
    - [x] `GET /api/contacts?q=`
    - [x] `POST /api/contacts`
    - [x] `GET /api/contacts/:id`
    - [x] `PATCH /api/contacts/:id`
  - [x] Validation: `name` non vide; canaux optionnels trim

- [x] Backend: liens contacts↔venues (AC #2)
  - [x] DB helpers `app/backend/lib/contact_venues.ts`
    - [x] `linkContactToVenue(db, contactId, venueId)` (idempotent)
    - [x] `unlinkContactFromVenue(db, contactId, venueId)` (idempotent)
    - [x] `listVenuesForContact(db, contactId)`
    - [x] `listContactsForVenue(db, venueId)`
  - [x] Routes (au choix, garder simple):
    - [x] `POST /api/contacts/:id/venues` body `{ venue_id }`
    - [x] `DELETE /api/contacts/:id/venues/:venue_id`
    - [x] `GET /api/contacts/:id/venues`
    - [x] `GET /api/venues/:id/contacts`

- [x] Backend: recherche (AC #3)
  - [x] Option A (recommandée MVP): endpoint global `GET /api/search?q=` qui renvoie `{ venues: [], contacts: [], opportunities: [] }`
  - [x] Option B: recherche par ressource (contacts/venues/opportunities) + UI qui agrège; uniquement si déjà une architecture front l’exige.
  - [x] Garder l’implémentation stable et testable; limiter le nombre de résultats (ex: 10 par type) pour la perf.

- [x] OpenAPI
  - [x] Mettre à jour `app/backend/openapi.yaml`:
    - [x] étendre `Contact` (instagram, notes)
    - [x] ajouter paths contacts + liens + search

- [x] Tests
  - [x] Unit tests DB helpers: `tests/unit/contacts.test.ts`, `tests/unit/contact_venues.test.ts`, `tests/unit/search.test.ts` (stubs `DbClient.query`)
  - [x] Intégration auth guard: `tests/integration/contacts_auth_guard.test.ts`, `tests/integration/search_auth_guard.test.ts`

## Dev Notes

- **Ne pas réinventer**: réutiliser le garde-fou JWT/session de `app/backend/routes/me.ts` (via `getSessionToken()` + `verifyJwt()`).
- **Idempotence**:
  - lier un contact à une salle déjà liée ne doit pas créer de doublon (contrainte UNIQUE + INSERT … ON CONFLICT DO NOTHING).
  - unlink sur lien absent doit retourner succès “no-op” (ou 404 explicite, mais rester cohérent et simple).
- **Cohérence future**:
  - `opportunities` a déjà `venue_id` dans `db/schema.sql` → la recherche doit pouvoir inclure `opportunities.title`.
  - éviter d’introduire des champs incompatibles avec `openapi.yaml` sans le mettre à jour.

### Project Structure Notes

- DB schema: `db/schema.sql`
- DB migrations: `db/migrations/`
- Backend routes: `app/backend/routes/`
- Backend DB helpers: `app/backend/lib/`
- OpenAPI: `app/backend/openapi.yaml`
- Tests: `tests/unit/` + `tests/integration/`

### References

- Epics/stories: `_bmad-output/planning-artifacts/epics.md` → “Story 1.4: Annuaire contacts + liens contacts↔salles + recherche”
- UX: `_bmad-output/planning-artifacts/ux-design-specification.md` → mobile-first, un CTA principal, feedback immédiat
- Architecture: `_bmad-output/planning-artifacts/architecture.md` → entités `Contact` et `Venue`
- OpenAPI: `app/backend/openapi.yaml` → schémas `Contact`, `Venue`, `Opportunity`

## Dev Agent Record

### Agent Model Used

GPT-5.2

### Debug Log References

- N/A (story prep only)

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- 2026-01-09: Story 1.4 générée automatiquement depuis `sprint-status.yaml` (prochaine entrée backlog)
- 2026-01-09: DB `contacts` + `contact_venues` ajoutées (migration 0005 + schema), test présence schema/migration ajouté, `npm test` OK
- 2026-01-09: CRUD contacts (helpers + routes) + tests unitaires + auth guard; `npm test` OK
- 2026-01-09: Liens contacts↔salles + recherche globale; tests unitaires + guards ajoutés; `npm test` OK
- 2026-01-09: OpenAPI mis à jour (contacts + liens + search). Story complète; `npm test` OK

### File List

- _bmad-output/implementation-artifacts/1-4-annuaire-contacts-liens-contactssalles-recherche.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- app/backend/lib/contacts.ts
- app/backend/lib/contact_venues.ts
- app/backend/lib/search.ts
- app/backend/routes/contact_venues.ts
- app/backend/routes/contacts.ts
- app/backend/routes/search.ts
- app/backend/server.ts
- app/backend/openapi.yaml
- db/migrations/0005_create_contacts_and_links.sql
- db/schema.sql
- package.json
- tests/integration/contacts_auth_guard.test.ts
- tests/integration/search_auth_guard.test.ts
- tests/unit/contacts.schema.test.ts
- tests/unit/contacts.test.ts
- tests/unit/contact_venues.test.ts
- tests/unit/search.test.ts

## Change Log

- 2026-01-09: Ajout Contacts + liens Contacts↔Salles + endpoint /api/search + mise à jour OpenAPI
