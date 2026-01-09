# Story 2.3: Historique (activity log) + interactions non-email

Status: ready-for-dev

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

- [ ] DB: introduire un journal d’activité + interactions non-email (AC #1-#2)
  - [ ] Ajouter une migration `db/migrations/0007_create_activity_log.sql` (ou prochain numéro) qui crée:
    - [ ] `activity_log`:
      - [ ] `id` UUID PK
      - [ ] `opportunity_id` UUID (référence vers opportunities; FK optionnelle MVP)
      - [ ] `actor_profile_id` UUID (référence vers profiles; FK optionnelle MVP)
      - [ ] `action_type` TEXT (ex: `non_email_interaction`, `status_changed`, `owner_changed`, `gmail_action`)
      - [ ] `occurred_at` TIMESTAMPTZ NOT NULL (timestamp métier)
      - [ ] `metadata` JSONB NOT NULL DEFAULT '{}' (payload structuré: canal, notes, etc.)
      - [ ] `created_at` TIMESTAMPTZ DEFAULT now()
    - [ ] Indexes:
      - [ ] `(opportunity_id, occurred_at DESC)`
      - [ ] `(action_type, occurred_at DESC)` (optionnel)
  - [ ] Mettre à jour `db/schema.sql` pour refléter la table

- [ ] Backend: API interactions non-email (AC #1)
  - [ ] DB helpers `app/backend/lib/activity_log.ts` (pattern `DbClient`)
    - [ ] `appendNonEmailInteraction(db, { opportunity_id, actor_profile_id, channel, occurred_at, notes })`
    - [ ] `listActivityForOpportunity(db, opportunityId, { limit? })`
  - [ ] Routes `app/backend/routes/activity_log.ts`
    - [ ] `GET /api/opportunities/:id/activity` → liste chronologique (desc)
    - [ ] `POST /api/opportunities/:id/interactions` body:
      - [ ] `channel`: `call|instagram|in_person|other` (string)
      - [ ] `occurred_at`: ISO datetime (optionnel; défaut = now)
      - [ ] `notes`: string (optionnel)
  - [ ] Mapping actor:
    - [ ] Récupérer `actor_profile_id` depuis le JWT (`sub`) utilisé dans `/api/me`.
  - [ ] Erreurs stables:
    - [ ] 401 `{ error: "unauthorized" }`
    - [ ] 400 `{ error: "invalid_request" }`
    - [ ] 404 `{ error: "not_found" }` si opportunité inexistante (si vérification implémentée)

- [ ] Backend: événements “status/owner/gmail” (AC #2)
  - [ ] MVP: définir le contrat `action_type` + `metadata` pour ces événements même si la production est partielle.
  - [ ] À brancher plus tard:
    - [ ] lors d’un update statut (Story 2.1) → append `status_changed`
    - [ ] lors d’un update owner (Epic 4) → append `owner_changed`
    - [ ] lors d’une action Gmail (Epic 5) → append `gmail_action`

- [ ] OpenAPI
  - [ ] Ajouter/mettre à jour `app/backend/openapi.yaml`:
    - [ ] schéma `ActivityLogEvent`
    - [ ] endpoints `GET /api/opportunities/{id}/activity` et `POST /api/opportunities/{id}/interactions`

- [ ] Frontend (si un UI minimal existe déjà)
  - [ ] Sur le détail opportunité: section “Historique” (liste chronologique)
  - [ ] Action “Ajouter interaction” (form simple: channel + notes + date/heure optionnelle)
  - [ ] Respect UX: feedback immédiat, pas d’échec silencieux, mobile-first

- [ ] Tests
  - [ ] Unit: `tests/unit/activity_log.test.ts` sur helpers DB (stubs `DbClient.query`)
  - [ ] Intégration (in-process): `tests/integration/activity_log_auth_guard.test.ts` (401 si non authentifié)
  - [ ] (Optionnel) test d’ordre chronologique (desc) via validation de la requête SQL générée

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

## Dev Agent Record

### Agent Model Used

GPT-5.2

### Debug Log References

- N/A (story prep only)

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- 2026-01-09: Story 2.3 générée automatiquement depuis `sprint-status.yaml` (prochaine entrée backlog)

### File List

- _bmad-output/implementation-artifacts/2-3-historique-activity-log-interactions-non-email.md
