# Story 1.3: Annuaire des salles (CRUD minimal)

Status: done

## Story

As a utilisateur,
I want créer, consulter et éditer une salle,
so that je puisse rattacher des opportunités à un lieu fiable.

## Acceptance Criteria

1. **Given** je suis connecté
   **When** je crée une salle avec au minimum un nom et une ville
   **Then** la salle est persistée et visible dans l’annuaire

2. **Given** une salle existe
   **When** je consulte sa page de détail
   **Then** je vois ses champs principaux (nom, ville, notes)

3. **Given** une salle existe
   **When** j’édite ses champs principaux
   **Then** les modifications sont enregistrées et visibles immédiatement

### Clarifications / Guardrails (pour éviter erreurs d’implémentation)

- **Modèle de données**: la table `venues` n’existe pas encore (voir `db/schema.sql`: `opportunities.venue_id` est commenté comme “optional reference to venues table if created”). Cette story DOIT introduire un modèle “salle/venue” minimal.
- **Champs MVP (source of truth)**:
  - `name` (obligatoire)
  - `city` (obligatoire)
  - `notes` (optionnel)
  - timestamps `created_at` / `updated_at`
- **Compat OpenAPI**: `app/backend/openapi.yaml` contient déjà un schéma `Venue` (name/address/geo/capacity) mais pas aligné avec (ville, notes). Ne pas “forcer” l’existant: soit (a) étendre le schéma avec `city`/`notes`, soit (b) décider explicitement que `address` = ville (déconseillé). Choix recommandé: **ajouter `city` et `notes`**.
- **Auth**: toutes les routes venues doivent exiger une session (JWT) comme `/api/me` (réutiliser `getSessionToken()` + `verifyJwt()` + `APP_JWT_SECRET`).
- **Scoping**:
  - Pas de recherche globale (Story 1.4).
  - Pas de gestion contacts↔salles (Story 1.4).
  - Pas de logique opportunités↔salles au-delà d’un `venue_id` stockable plus tard.

## Tasks / Subtasks

- [x] DB: introduire la table `venues` (AC #1-#3)
  - [x] Ajouter une migration `db/migrations/0004_create_venues.sql` (ou prochain numéro) qui crée `venues` + indexes
  - [x] Mettre à jour `db/schema.sql` pour refléter la table `venues`
  - [x] (Optionnel, seulement si simple) Ajouter une contrainte FK `opportunities.venue_id -> venues.id` (sinon laisser sans FK pour MVP)

- [x] Backend: CRUD minimal venues (AC #1-#3)
  - [x] Créer un module DB helper `app/backend/lib/venues.ts` (pattern `DbClient` comme `app/backend/lib/allowlist.ts` / `admin_members.ts`)
    - [x] `createVenue(db, { name, city, notes? })`
    - [x] `listVenues(db)` (tri stable, ex: `ORDER BY lower(name)`)
    - [x] `getVenueById(db, id)`
    - [x] `updateVenue(db, id, { name?, city?, notes? })`
  - [x] Créer les routes `app/backend/routes/venues.ts` (pattern Fastify + pool singleton comme `admin_members.ts`)
    - [x] `GET /api/venues` → liste
    - [x] `POST /api/venues` body `{ name, city, notes? }` → crée
    - [x] `GET /api/venues/:id` → détail
    - [x] `PATCH /api/venues/:id` body `{ name?, city?, notes? }` → update champs principaux
  - [x] Erreurs stables:
    - [x] 401 `{ error: "unauthorized" }` si pas de session / token invalide
    - [x] 400 `{ error: "invalid_request" }` si body/params invalides
    - [x] 404 `{ error: "not_found" }` si id inconnu

- [x] OpenAPI
  - [x] Ajouter les paths venues dans `app/backend/openapi.yaml`
  - [x] Aligner le schéma `Venue` avec les champs MVP (`name`, `city`, `notes`) ou documenter clairement la correspondance

- [x] Frontend (si un UI minimal existe déjà)
  - [x] Une vue liste “Annuaire salles” qui affiche au moins `name` + `city` (AC #1)
  - [x] Une vue détail salle avec `name`, `city`, `notes` (AC #2)
  - [x] Un formulaire simple créer/éditer (AC #1/#3)
  - [x] Respecter UX: mobile-first, champs courts, feedback immédiat, pas d’échec silencieux

- [x] Tests
  - [x] Unit: `tests/unit/venues.test.ts` sur helpers DB (stubs de `DbClient.query`)
  - [x] Intégration (in-process): `tests/integration/venues_auth_guard.test.ts` (401 si non authentifié)
  - [x] (Optionnel) Intégration happy path si un DB de test est disponible, sinon limiter aux tests unitaires DB helpers

## Dev Notes

- **Patterns à réutiliser**:
  - session/JWT: `app/backend/lib/session_token.ts`, `app/backend/lib/jwt.ts`, route exemple `app/backend/routes/me.ts`
  - pool DB singleton dans un module de routes: voir `app/backend/routes/admin_members.ts`
  - style d’erreurs JSON stables (401/403/400/404): cohérent avec story 1.2
- **Validation des champs**:
  - `name` et `city` non vides, trim, tailles raisonnables (éviter strings vides)
  - `notes` optionnel, trim
- **Performance MVP**: la liste doit être triée de façon stable et indexable (`lower(name)`), sans sur-concevoir la recherche (Story 1.4).

### Project Structure Notes

- DB schema: `db/schema.sql`
- DB migrations: `db/migrations/`
- Backend routes: `app/backend/routes/`
- Backend DB helpers: `app/backend/lib/`
- OpenAPI: `app/backend/openapi.yaml`
- Tests: `tests/unit/` + `tests/integration/`

### References

- Epics/stories: `_bmad-output/planning-artifacts/epics.md` → “Story 1.3: Annuaire des salles (CRUD minimal)”
- Architecture: `_bmad-output/planning-artifacts/architecture.md` → “Data model skeleton (Venue)”
- UX: `_bmad-output/planning-artifacts/ux-design-specification.md` → principes “mobile-first”, “single primary action”, feedback immédiat
- DB: `db/schema.sql` → `opportunities.venue_id` (référence venue à créer)

## Dev Agent Record

### Agent Model Used

GPT-5.2

### Debug Log References

- N/A (story prep only)

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- 2026-01-09: Story 1.3 générée automatiquement depuis `sprint-status.yaml` (première entrée backlog de l’epic 1)
- 2026-01-09: DB venues ajoutée (migration + schema) + FK opportunités. Test unitaire de présence schema/migration.
- 2026-01-09: Backend venues CRUD minimal (helpers + routes). Tests: unit helpers + integration auth guard. Suite `npm test` mise à jour.
- 2026-01-09: OpenAPI venues ajouté + schéma Venue aligné (name/city/notes). Frontend: N/A (aucune app UI existante dans `app/frontend/`).

### File List

- _bmad-output/implementation-artifacts/1-3-annuaire-des-salles-crud-minimal.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- db/migrations/0004_create_venues.sql
- db/schema.sql
- app/backend/lib/venues.ts
- app/backend/routes/venues.ts
- app/backend/openapi.yaml
- tests/unit/venues.schema.test.ts
- tests/unit/venues.test.ts
- tests/integration/venues_auth_guard.test.ts
- tests/integration/venues_happy_path.test.ts
- package.json

## Change Log

- 2026-01-09: Story 1.3 implémentée (DB venues + CRUD backend + OpenAPI + tests). Frontend non applicable (pas d'app UI existante).
