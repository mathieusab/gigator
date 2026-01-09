# Story 2.1: CRUD opportunité + statuts gagnée/perdue

Status: ready-for-dev

## Story

As a utilisateur,
I want créer et mettre à jour une opportunité liée à une salle,
so that je puisse suivre l’avancement du booking.

## Acceptance Criteria

1. **Given** une salle existe
   **When** je crée une opportunité associée à cette salle
   **Then** l’opportunité est persistée et visible dans le pipeline

2. **Given** une opportunité existe
   **When** je modifie son statut et ses notes
   **Then** les modifications sont enregistrées

3. **Given** une opportunité existe
   **When** je la marque “confirmée” (won) ou “perdue” (lost)
   **Then** son statut reflète l’état choisi et est visible dans les listes

### Clarifications / Guardrails (pour éviter erreurs d’implémentation)

- **Modèle DB existant**: la table `opportunities` existe déjà dans `db/schema.sql` avec un enum `opportunity_status` (valeurs: `draft`, `open`, `negotiating`, `booked`, `cancelled`, `declined`, `archived`).
  - **Mapping MVP**: 
    - “won/confirmée” → `booked`
    - “lost/perdue” → `declined` (ou `cancelled` si l’opportunité était déjà avancée; MVP: choisir `declined` et documenter)
- **Notes**: `opportunities.description` peut servir de “notes” MVP. Ne pas créer un second champ “notes” si `description` suffit.
- **Lien salle**: `opportunities.venue_id` existe, mais la table `venues` doit exister (Story 1.3). Si la FK n’est pas en place, accepter `venue_id` comme UUID sans FK pour MVP.
- **Auth**: toutes les routes opportunités doivent exiger une session (JWT) comme `/api/me` (réutiliser `getSessionToken()` + `verifyJwt()` + `APP_JWT_SECRET`).
- **Scope**:
  - Pas de next action / due date (Story 2.2).
  - Pas d’activity log (Story 2.3).
  - Pas d’ownership (Epic 4).

## Tasks / Subtasks

- [ ] Backend: CRUD opportunités (AC #1-#3)
  - [ ] Créer DB helpers `app/backend/lib/opportunities.ts` (pattern `DbClient`)
    - [ ] `createOpportunity(db, { title, description?, venue_id? })`
    - [ ] `listOpportunities(db, { venue_id? }?)` (tri stable, ex: `updated_at DESC`)
    - [ ] `getOpportunityById(db, id)`
    - [ ] `updateOpportunity(db, id, { status?, description?, title?, venue_id? })`
  - [ ] Créer routes `app/backend/routes/opportunities.ts`
    - [ ] `GET /api/opportunities`
    - [ ] `POST /api/opportunities`
    - [ ] `GET /api/opportunities/:id`
    - [ ] `PATCH /api/opportunities/:id`
  - [ ] Validation:
    - [ ] `title` obligatoire à la création
    - [ ] `status` doit être une valeur de l’enum DB (ou une liste autorisée explicitement)
  - [ ] Erreurs stables:
    - [ ] 401 `{ error: "unauthorized" }`
    - [ ] 400 `{ error: "invalid_request" }`
    - [ ] 404 `{ error: "not_found" }`

- [ ] API “mark won/lost” (AC #3)
  - [ ] Option A (simple): utiliser `PATCH /api/opportunities/:id` avec `status=booked|declined`
  - [ ] Option B (plus explicite): endpoints dédiés
    - [ ] `POST /api/opportunities/:id/mark-won` → set `booked`
    - [ ] `POST /api/opportunities/:id/mark-lost` → set `declined`
  - [ ] MVP recommandé: **Option A** (évite multiplier endpoints)

- [ ] OpenAPI
  - [ ] Ajouter les paths opportunités si manquants, ou aligner ceux existants dans `app/backend/openapi.yaml`
  - [ ] Aligner les champs:
    - [ ] `cachet` vs `cachet_amount_cents` (si non utilisé, laisser hors MVP)
    - [ ] `status` doit refléter l’enum DB (pas une description libre)

- [ ] Frontend (si un UI minimal existe déjà)
  - [ ] Vue “pipeline” listant les opportunités
  - [ ] Création opportunité (title + venue si dispo)
  - [ ] Détail opportunité: afficher status + notes, action “Marquer gagnée/perdue”
  - [ ] Respect UX: un CTA principal, feedback immédiat

- [ ] Tests
  - [ ] Unit: `tests/unit/opportunities.test.ts` sur helpers DB (stubs `DbClient.query`)
  - [ ] Intégration (in-process): `tests/integration/opportunities_auth_guard.test.ts` (401 si non authentifié)
  - [ ] (Optionnel) tests de validation `status` (400 si valeur inconnue)

## Dev Notes

- **Ne pas réinventer**: réutiliser le garde-fou session/JWT déjà utilisé sur `app/backend/routes/admin_members.ts` et `app/backend/routes/me.ts`.
- **Cohérence DB**: privilégier `opportunity_status` en DB comme source of truth; éviter des statuts “free-form”.
- **Évolutivité**: garder le modèle simple, car 2.2/2.3 ajouteront due dates, activity log, etc.

### Project Structure Notes

- DB schema: `db/schema.sql` (table `opportunities`, enum `opportunity_status`)
- Backend routes: `app/backend/routes/`
- Backend DB helpers: `app/backend/lib/`
- OpenAPI: `app/backend/openapi.yaml`
- Tests: `tests/unit/` + `tests/integration/`

### References

- Epics/stories: `_bmad-output/planning-artifacts/epics.md` → “Story 2.1: CRUD opportunité + statuts gagnée/perdue”
- DB: `db/schema.sql` → `opportunities` + enum `opportunity_status`
- UX: `_bmad-output/planning-artifacts/ux-design-specification.md` → mobile-first, feedback immédiat

## Dev Agent Record

### Agent Model Used

GPT-5.2

### Debug Log References

- N/A (story prep only)

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- 2026-01-09: Story 2.1 générée automatiquement depuis `sprint-status.yaml` (prochaine entrée backlog)

### File List

- _bmad-output/implementation-artifacts/2-1-crud-opportunite-statuts-gagneeperdue.md
