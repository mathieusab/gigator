# Story 2.2: Next action + relance due/overdue

Status: ready-for-dev

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

- [ ] DB: ajouter les champs à `opportunities` (AC #1)
  - [ ] Ajouter migration `db/migrations/0006_add_opportunities_follow_up.sql` (ou prochain numéro):
    - [ ] `ALTER TABLE opportunities ADD COLUMN next_action TEXT;`
    - [ ] `ALTER TABLE opportunities ADD COLUMN follow_up_due_date DATE;`
  - [ ] Ajouter un index simple si nécessaire pour la vue “due/overdue”:
    - [ ] `CREATE INDEX ... ON opportunities (follow_up_due_date);`
  - [ ] Mettre à jour `db/schema.sql`

- [ ] Backend: update opportunité avec next_action + follow_up_due_date (AC #1)
  - [ ] Étendre `app/backend/lib/opportunities.ts`:
    - [ ] permettre `next_action` + `follow_up_due_date` dans `updateOpportunity()`
    - [ ] retourner ces champs dans les réponses `get/list`
  - [ ] Validation:
    - [ ] `next_action` trim (accepter vide → NULL ou "")
    - [ ] `follow_up_due_date` format ISO date (`YYYY-MM-DD`)

- [ ] Backend: vue de suivi due/overdue (AC #2)
  - [ ] Option A (recommandée): `GET /api/opportunities/follow-ups` qui renvoie:
    - [ ] `due`: opportunités avec `follow_up_due_date = today`
    - [ ] `overdue`: opportunités avec `follow_up_due_date < today`
  - [ ] Option B: filtre sur `GET /api/opportunities?follow_up=due|overdue`
  - [ ] MVP recommandé: **Option B** (moins d’endpoints) si `GET /api/opportunities` existe déjà.
  - [ ] Toujours limiter le volume (ex: top 50) + tri stable (`follow_up_due_date ASC`, puis `updated_at DESC`).

- [ ] OpenAPI
  - [ ] Mettre à jour `app/backend/openapi.yaml`:
    - [ ] étendre `Opportunity` / `OpportunityUpdate` avec `next_action` et `follow_up_due_date`
    - [ ] documenter le filtre due/overdue si implémenté

- [ ] Frontend (si un UI minimal existe déjà)
  - [ ] Sur le détail opportunité: champs éditables “Prochaine action” + “Relance le” (AC #1)
  - [ ] Une vue de suivi “Relances” listant due/overdue (AC #2)
  - [ ] Indicateur visuel simple (badge “Due” / “Overdue”) sur les listes
  - [ ] Respect UX: mobile-first, un CTA principal, feedback immédiat

- [ ] Tests
  - [ ] Unit: `tests/unit/opportunities_follow_up.test.ts` sur helpers DB (stubs `DbClient.query`) incluant calcul due/overdue si fait côté code
  - [ ] Intégration auth guard: endpoint(s) follow-up doivent renvoyer 401 sans session
  - [ ] Tests date: cas `today` vs `past` (en fixant la date via injection/clock ou en testant la requête SQL générée)

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

### File List

- _bmad-output/implementation-artifacts/2-2-next-action-relance-dueoverdue.md
