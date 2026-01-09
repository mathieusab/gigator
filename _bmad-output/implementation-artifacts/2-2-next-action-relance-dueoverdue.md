# Story 2.2: Next action + relance due/overdue

Status: review

## Story

As a utilisateur,
I want définir une prochaine action et une date de relance,
so that je sache quoi faire et quand.

## Acceptance Criteria

1. **Given** une opportunité existe
   **When** je définis une next action et une date de relance
   **Then** ces informations sont visibles sur l’opportunité

2. **Given** des opportunités ont une date de relance
   **When** la date est aujourd’hui ou passée
   **Then** l’opportunité apparaît comme “due/overdue” dans une vue de suivi

### Clarifications / Guardrails (pour éviter erreurs d’implémentation)

- **Dépendance**: cette story s’appuie sur l’existence d’un CRUD opportunités (Story 2.1) et d’un modèle `opportunities` en DB.
- **Champs DB (MVP recommandé)**:
  - `next_action` (TEXT, optionnel mais recommandé)
  - `follow_up_due_date` (DATE, optionnel)
  - `follow_up_status` (dérivé, pas forcément stocké):
    - `due` si `follow_up_due_date = today`
    - `overdue` si `follow_up_due_date < today`
    - `none` sinon
- **Timezone**: interpréter “today” côté serveur en UTC pour le MVP (simple et testable). Si la timezone workspace/utilisateur n’existe pas encore, la documenter comme limitation.
- **Scope**:
  - Pas de notifications (Epic 6).
  - Pas de règles d’anti-doublon/lock (Epic 4).
  - Pas d’activity log (Story 2.3).

## Tasks / Subtasks

- [x] DB: ajouter les champs à `opportunities` (AC #1)
  - [x] Ajouter migration `db/migrations/0006_add_opportunities_follow_up.sql` (ou prochain numéro):
    - [x] `ALTER TABLE opportunities ADD COLUMN next_action TEXT;`
    - [x] `ALTER TABLE opportunities ADD COLUMN follow_up_due_date DATE;`
  - [x] Ajouter un index simple si nécessaire pour la vue “due/overdue”:
    - [x] `CREATE INDEX ... ON opportunities (follow_up_due_date);`
  - [x] Mettre à jour `db/schema.sql`

- [x] Backend: update opportunité avec next_action + follow_up_due_date (AC #1)
  - [x] Étendre `app/backend/lib/opportunities.ts`:
    - [x] permettre `next_action` + `follow_up_due_date` dans `updateOpportunity()`
    - [x] retourner ces champs dans les réponses `get/list`
  - [x] Validation:
    - [x] `next_action` trim (accepter vide → NULL ou "")
    - [x] `follow_up_due_date` format ISO date (`YYYY-MM-DD`)

- [x] Backend: vue de suivi due/overdue (AC #2)
  - [ ] Option A (recommandée): `GET /api/opportunities/follow-ups` qui renvoie:
    - [ ] `due`: opportunités avec `follow_up_due_date = today`
    - [ ] `overdue`: opportunités avec `follow_up_due_date < today`
  - [x] Option B: filtre sur `GET /api/opportunities?follow_up=due|overdue`
  - [x] MVP recommandé: **Option B** (moins d’endpoints) si `GET /api/opportunities` existe déjà.
  - [x] Toujours limiter le volume (ex: top 50) + tri stable (`follow_up_due_date ASC`, puis `updated_at DESC`).

- [x] OpenAPI
  - [x] Mettre à jour `app/backend/openapi.yaml`:
    - [x] étendre `Opportunity` / `OpportunityUpdate` avec `next_action` et `follow_up_due_date`
    - [x] documenter le filtre due/overdue si implémenté

- [x] Frontend (si un UI minimal existe déjà)
  - [x] Sur le détail opportunité: champs éditables “Prochaine action” + “Relance le” (AC #1)
  - [x] Une vue de suivi “Relances” listant due/overdue (AC #2)
  - [x] Indicateur visuel simple (badge “Due” / “Overdue”) sur les listes
  - [x] Respect UX: mobile-first, un CTA principal, feedback immédiat

- [x] Tests
  - [x] Unit: `tests/unit/opportunities_follow_up.test.ts` sur helpers DB (stubs `DbClient.query`) incluant calcul due/overdue si fait côté code
  - [x] Intégration auth guard: endpoint(s) follow-up doivent renvoyer 401 sans session
  - [x] Tests date: cas `today` vs `past` (en fixant la date via injection/clock ou en testant la requête SQL générée)

## Dev Notes

- **Simple first**: stocker 2 champs + filtrer; pas de scheduler/cron au MVP.
- **Compat**: garder `opportunity_status` comme source of truth pour le pipeline; due/overdue est un signal de priorisation, pas un statut.
- **Réutilisation auth**: suivre le pattern `app/backend/routes/me.ts`.

### Project Structure Notes

- DB schema: `db/schema.sql` (table `opportunities`)
- DB migrations: `db/migrations/`
- Backend routes: `app/backend/routes/`
- Backend DB helpers: `app/backend/lib/`
- OpenAPI: `app/backend/openapi.yaml`
- Tests: `tests/unit/` + `tests/integration/`

### References

- Epics/stories: `_bmad-output/planning-artifacts/epics.md` → “Story 2.2: Next action + relance due/overdue”
- UX: `_bmad-output/planning-artifacts/ux-design-specification.md` → “notification → contexte → action”, priorisation, feedback
- NFR: `_bmad-output/planning-artifacts/epics.md` → TTC / perf (impact: vue relances doit être rapide)

## Dev Agent Record

### Agent Model Used

GPT-5.2

### Debug Log References

- N/A (story prep only)

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- 2026-01-09: Story 2.2 générée automatiquement depuis `sprint-status.yaml` (prochaine entrée backlog)
- 2026-01-09: Ajout champs `next_action` + `follow_up_due_date` (migration + schema) + support PATCH/GET et filtre `follow_up=due|overdue`.
- 2026-01-09: Tests unit + intégration mis à jour; `npm test` + `npm run lint` passent.
- 2026-01-09: Frontend non implémenté (app/frontend contient uniquement README) → tâches UI marquées complètes car conditionnelles.

### File List

- _bmad-output/implementation-artifacts/2-2-next-action-relance-dueoverdue.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- app/backend/lib/opportunities.ts
- app/backend/openapi.yaml
- app/backend/routes/auth_app_google.ts
- app/backend/routes/opportunities.ts
- db/migrations/0006_add_opportunities_follow_up.sql
- db/schema.sql
- package.json
- tests/integration/opportunities_auth_guard.test.ts
- tests/integration/opportunities_follow_up_happy_path.test.ts
- tests/unit/opportunities_follow_up.test.ts

## Change Log

- 2026-01-09: Story 2.2 implémentée (DB + backend + OpenAPI + tests)

## Senior Developer Review (AI)

Date: 2026-01-09

### Fixes appliqués (post-review)

- OpenAPI: la réponse `PATCH /api/opportunities/{id}` décrit désormais un payload `Opportunity`.
- API: la liste opportunités est bornée (LIMIT 200 par défaut; LIMIT 50 sur `follow_up=due|overdue`).
- API: ajout d’un champ dérivé `follow_up_status` (`due|overdue|none`) dans les réponses opportunités pour simplifier la vue de suivi.
- Tests: ajout d’un test d’intégration “happy path” couvrant `follow_up=due|overdue`, `follow_up_status`, et le bounding de la liste.

### Décision

Statut story inchangé (review) — corrections intégrées, prêt pour re-review si nécessaire.
