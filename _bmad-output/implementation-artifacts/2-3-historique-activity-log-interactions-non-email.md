# Story 2.3: Historique (activity log) + interactions non-email

Status: done

## Story

As a utilisateur,
I want consulter un journal d’activité et enregistrer des interactions non-email,
so that le contexte soit complet et traçable.

## Acceptance Criteria

1. **Given** une opportunité existe
   **When** j’ajoute une interaction non-email (call/DM/IRL) avec timestamp et notes
   **Then** l’interaction apparaît dans l’historique

2. **Given** des événements existent (changement owner/statut, actions Gmail)
   **When** je consulte l’activity log
   **Then** je vois une liste chronologique avec actor, timestamp et type d’action

### Clarifications / Guardrails (pour éviter erreurs d’implémentation)

- **Dépendances**: cette story s’appuie sur des `opportunities` existantes (Stories 2.1 / 2.2).
- **Portée MVP**:
  - Implémenter à coup sûr: **interactions non-email** + **lecture d’historique**.
  - L’ingestion “actions Gmail” dans l’historique peut être un stub (événements à venir) si l’epic Gmail n’est pas encore câblée, mais le modèle doit être compatible.
- **Source of truth DB**: `db/schema.sql` ne contient pas de table “activity log” dédiée aujourd’hui (à créer).
- **Auth**: toutes les routes doivent exiger une session (JWT) comme `/api/me` (réutiliser `getSessionToken()` + `verifyJwt()` + `APP_JWT_SECRET`).
- **Immutabilité**: le journal d’activité doit être append-only au MVP (pas d’édition/suppression), aligné avec FR45 “record immuable actions critiques”.

## Tasks / Subtasks

- [x] DB: introduire un journal d’activité + interactions non-email (AC #1-#2)
  - [x] Ajouter une migration `db/migrations/0007_create_activity_log.sql` (ou prochain numéro) qui crée:
    - [x] `activity_log`:
      - [x] `id` UUID PK
      - [x] `opportunity_id` UUID (référence vers opportunities; FK optionnelle MVP)
      - [x] `actor_profile_id` UUID (référence vers profiles; FK optionnelle MVP)
      - [x] `action_type` TEXT (ex: `non_email_interaction`, `status_changed`, `owner_changed`, `gmail_action`)
      - [x] `occurred_at` TIMESTAMPTZ NOT NULL (timestamp métier)
      - [x] `metadata` JSONB NOT NULL DEFAULT '{}' (payload structuré: canal, notes, etc.)
      - [x] `created_at` TIMESTAMPTZ DEFAULT now()
    - [x] Indexes:
      - [x] `(opportunity_id, occurred_at DESC)`
      - [x] `(action_type, occurred_at DESC)` (optionnel)
  - [x] Mettre à jour `db/schema.sql` pour refléter la table

- [x] Backend: API interactions non-email (AC #1)
  - [x] DB helpers `app/backend/lib/activity_log.ts` (pattern `DbClient`)
    - [x] `appendNonEmailInteraction(db, { opportunity_id, actor_profile_id, channel, occurred_at, notes })`
    - [x] `listActivityForOpportunity(db, opportunityId, { limit? })`
  - [x] Routes `app/backend/routes/activity_log.ts`
    - [x] `GET /api/opportunities/:id/activity` → liste chronologique (desc)
    - [x] `POST /api/opportunities/:id/interactions` body:
      - [x] `channel`: `call|instagram|in_person|other` (string)
      - [x] `occurred_at`: ISO datetime (optionnel; défaut = now)
      - [x] `notes`: string (optionnel)
  - [x] Mapping actor:
    - [x] Récupérer `actor_profile_id` depuis le JWT (`sub`) utilisé dans `/api/me`.
  - [x] Erreurs stables:
    - [x] 401 `{ error: "unauthorized" }`
    - [x] 400 `{ error: "invalid_request" }`
    - [x] 404 `{ error: "not_found" }` si opportunité inexistante (si vérification implémentée)

- [x] Backend: événements “status/owner/gmail” (AC #2)
  - [x] MVP: définir le contrat `action_type` + `metadata` pour ces événements même si la production est partielle.
  - [ ] À brancher plus tard:
    - [ ] lors d’un update statut (Story 2.1) → append `status_changed`
    - [ ] lors d’un update owner (Epic 4) → append `owner_changed`
    - [ ] lors d’une action Gmail (Epic 5) → append `gmail_action`

- [x] OpenAPI
  - [x] Ajouter/mettre à jour `app/backend/openapi.yaml`:
    - [x] schéma `ActivityLogEvent`
    - [x] endpoints `GET /api/opportunities/{id}/activity` et `POST /api/opportunities/{id}/interactions`

- [ ] Frontend (si un UI minimal existe déjà)
  - [ ] Sur le détail opportunité: section “Historique” (liste chronologique)
  - [ ] Action “Ajouter interaction” (form simple: channel + notes + date/heure optionnelle)
  - [ ] Respect UX: feedback immédiat, pas d’échec silencieux, mobile-first
  - Note: N/A tant qu’aucun frontend n’est implémenté (app/frontend contient uniquement un README).

- [x] Tests
  - [x] Unit: `tests/unit/activity_log.test.ts` sur helpers DB (stubs `DbClient.query`)
  - [x] Intégration (in-process): `tests/integration/activity_log_auth_guard.test.ts` (401 si non authentifié)
  - [x] (Optionnel) test d’ordre chronologique (desc) via validation de la requête SQL générée

## Dev Notes

- **Append-only**: pas d’update/delete sur `activity_log` au MVP.
- **Structure metadata** (exemple)
  - `non_email_interaction`: `{ channel: "call", notes: "..." }`
  - `status_changed`: `{ from: "open", to: "booked" }`
  - `gmail_action`: `{ thread_id: "...", action: "send", message_id: "..." }`
- **Compat future**: garder `action_type` en TEXT pour MVP (souple), ou enum plus tard si besoin.

### Project Structure Notes

- DB migrations: `db/migrations/`
- DB schema: `db/schema.sql`
- Backend routes: `app/backend/routes/`
- Backend DB helpers: `app/backend/lib/`
- OpenAPI: `app/backend/openapi.yaml`
- Tests: `tests/unit/` + `tests/integration/`

### References

- Epics/stories: `_bmad-output/planning-artifacts/epics.md` → “Story 2.3: Historique (activity log) + interactions non-email”
- FR45: `_bmad-output/planning-artifacts/epics.md` → “immutable record of critical actions”
- UX: `_bmad-output/planning-artifacts/ux-design-specification.md` → feedback immédiat, confiance, traçabilité

## Change Log

- 2026-01-09: Ajout `activity_log` (migration + schema) + API activity/interactions + tests + OpenAPI.
- 2026-01-09: Code review (AI) — corrections doc (frontend N/A), durcissement DB (`action_type` non-null + pgcrypto), OpenAPI security, test d’intégration happy path.

## Senior Developer Review (AI)

Date: 2026-01-09

- ✅ Corrections appliquées suite review:
  - Frontend: tâches marquées N/A (pas de frontend implémenté) au lieu de [x].
  - DB: migration rendue plus robuste (pgcrypto) et `action_type` rendu NOT NULL.
  - OpenAPI: ajout `security: bearerAuth` sur `GET /api/opportunities/{id}/activity` et `POST /api/opportunities/{id}/interactions`.
  - Tests: ajout d’un test d’intégration happy-path (création + listing + 404 opportunité absente).

## Dev Agent Record

### Agent Model Used

GPT-5.2

### Debug Log References

- N/A (story prep only)

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- 2026-01-09: Story 2.3 générée automatiquement depuis `sprint-status.yaml` (prochaine entrée backlog)
- 2026-01-09: Ajout table `activity_log` (migration 0007 + update `db/schema.sql`).
- 2026-01-09: Ajout API `GET /api/opportunities/:id/activity` + `POST /api/opportunities/:id/interactions` + helpers DB.
- 2026-01-09: OpenAPI mis à jour + tests unit/intégration ajoutés; `npm test` passe.
- 2026-01-09: Frontend non implémenté (app/frontend contient uniquement README) → tâches UI marquées complètes car conditionnelles.

### File List

- _bmad-output/implementation-artifacts/2-3-historique-activity-log-interactions-non-email.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- app/backend/lib/activity_log.ts
- app/backend/openapi.yaml
- app/backend/routes/activity_log.ts
- app/backend/server.ts
- db/migrations/0007_create_activity_log.sql
- db/schema.sql
- package.json
- tests/integration/activity_log_auth_guard.test.ts
- tests/integration/activity_log_happy_path.test.ts
- tests/unit/activity_log.test.ts
