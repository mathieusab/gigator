# Story 1.2: Gestion des membres (inviter / désactiver)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want inviter et désactiver/réactiver des membres,
so that l’accès à l’outil reste maîtrisé.

## Acceptance Criteria

1. **Given** je suis admin
   **When** j’invite un membre avec un email
   **Then** l’email est ajouté à la whitelist et le membre apparaît dans la liste des membres

2. **Given** un membre existe
   **When** je le désactive
   **Then** il ne peut plus se connecter
   **And** son statut est visible dans la liste des membres

### Clarifications / Guardrails (pour éviter erreurs d’implémentation)

- **Source of truth (MVP)**: la whitelist applicative est `app_email_allowlist` (voir `db/schema.sql` + migration `db/migrations/0002_create_app_email_allowlist.sql`).
- **Effet attendu de “désactiver”**: un membre `is_active=false` doit être refusé lors du login Google (flow “app_login”) avec `403 { error: "access_denied" }` (aligné avec la Story 1.1).
- **Idempotence**:
  - inviter un email déjà présent doit être idempotent (pas de doublon), et doit réactiver l’entrée si elle était inactive.
  - désactiver/réactiver une entrée déjà dans l’état cible doit être idempotent.
- **Normalisation email**: utiliser une comparaison case-insensitive (`lower(email)`), cohérente avec `app/backend/lib/allowlist.ts` et l’index `idx_app_email_allowlist_email_lower`.
- **Définition “admin” (MVP pragmatique)**: tant que les rôles org ne sont pas câblés, utiliser une liste statique d’emails admins via env (ex: `APP_ADMIN_EMAILS=email1,email2`). Ne pas sur-concevoir.

## Tasks / Subtasks

- [x] Définir un garde-fou d’auth + admin pour endpoints “gestion membres” (AC #1/#2)
  - [x] Réutiliser le pattern existant de parsing token (Bearer ou cookie) depuis `app/backend/routes/me.ts`
  - [x] Réutiliser `verifyJwt()` (`app/backend/lib/jwt.ts`) + `APP_JWT_SECRET`
  - [x] Implémenter `isAdmin(email)` basé sur `APP_ADMIN_EMAILS` (CSV, lowercased)
  - [x] Erreurs stables:
    - [x] `401 { error: "unauthorized" }` si pas de session
    - [x] `403 { error: "forbidden" }` si non-admin

- [x] Implémenter le “members API” (whitelist management)
  - [x] Ajouter un module de routes (ex: `app/backend/routes/admin_members.ts`) avec endpoints:
    - [x] `GET /api/admin/members` → liste des entrées `{ id, email, is_active, created_at, updated_at }` triée par `email`
    - [x] `POST /api/admin/members` (body `{ email }`) → ajoute (ou réactive) une entrée
    - [x] `PATCH /api/admin/members/:id` (body `{ is_active: boolean }`) → toggle actif/inactif
  - [x] Implémenter la logique DB via fonctions dédiées basées sur l’interface `DbClient` (pattern `app/backend/lib/allowlist.ts`), pour faciliter des tests sans Postgres réel
  - [x] Garantir que `POST` et `PATCH` sont idempotents

- [x] Mettre à jour le login pour respecter l’état d’activation (AC #2)
  - [x] Vérifier que `app/backend/lib/allowlist.ts:isEmailAllowed()` est utilisé dans le flow OAuth app login quand `APP_EMAIL_ALLOWLIST` n’est pas défini
  - [x] Ajouter (si manquant) un test qui prouve: `is_active=false` → login refusé (403)

- [x] OpenAPI
  - [x] Ajouter les paths `/api/admin/members` et `/api/admin/members/{id}` dans `app/backend/openapi.yaml`
  - [x] Documenter sécurité (`bearerAuth`) + réponses 401/403

- [x] Tests
  - [x] Tests unitaires sur la logique DB (stubs de `DbClient.query`) pour:
    - [x] upsert invite (nouvelle entrée)
    - [x] invite réactive une entrée inactive
    - [x] set `is_active=false` puis `true`
  - [x] Test d’intégration (in-process) sur l’admin guard:
    - [x] non authentifié → 401
    - [x] authentifié non-admin → 403

## Dev Notes

- **Ne pas réinventer**:
  - réutiliser la logique allowlist existante `app/backend/lib/allowlist.ts`.
  - réutiliser la vérification JWT existante `app/backend/lib/jwt.ts` et le pattern de token extraction de `app/backend/routes/me.ts`.
- **DB & migrations**:
  - la table `app_email_allowlist` existe déjà; éviter d’introduire une seconde table “members” pour le MVP.
  - privilégier des requêtes simples et indexées (`lower(email)`), pas de scan.
- **Sécurité**:
  - ne pas logger des tokens ni des headers sensibles (suivre le pattern de sanitization dans `app/backend/routes/auth_app_google.ts`).
  - l’API admin doit refuser par défaut (401/403 stables).
- **Portée MVP**:
  - pas de gestion fine des rôles via `organization_members` dans cette story (à traiter plus tard quand l’org/workspace est réellement câblé).

### Project Structure Notes

- Auth app login: `app/backend/routes/auth_app_google.ts`, `app/backend/controllers/auth_app.ts`
- Allowlist helpers: `app/backend/lib/allowlist.ts`
- JWT/session: `app/backend/lib/jwt.ts`, `app/backend/routes/me.ts`
- DB schema/migrations: `db/schema.sql`, `db/migrations/0002_create_app_email_allowlist.sql`

### References

- Epics/stories: `_bmad-output/planning-artifacts/epics.md` → “Story 1.2: Gestion des membres (inviter / désactiver)”
- PRD: `_bmad-output/planning-artifacts/prd.md` → “Functional Requirements → User Access & Team Setup (FR1, FR2)”
- Impl existante (Story 1.1): `_bmad-output/implementation-artifacts/1-1-auth-google-whitelist-profil.md`
- Code: `app/backend/lib/allowlist.ts`, `app/backend/controllers/auth_app.ts`

## Dev Agent Record

### Agent Model Used

GPT-5.2

### Debug Log References

- N/A (story prep only)

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- 2026-01-09: Ajout API admin members (GET/POST/PATCH) sur `app_email_allowlist` avec garde-fou JWT+admin (`APP_ADMIN_EMAILS`).
- 2026-01-09: Tests ajoutés (unit + intégration) + exécution `npm test` OK.

### File List

- app/backend/lib/admin_members.ts
- app/backend/routes/admin_members.ts
- app/backend/openapi.yaml
- tests/unit/admin_members.test.ts
- tests/integration/admin_members_guard.test.ts
- tests/integration/auth_app_oauth_deny_allowlist_inactive.test.ts
- package.json
- _bmad-output/implementation-artifacts/1-2-gestion-des-membres-inviter-desactiver.md

## Change Log

- 2026-01-09: Implémentation Story 1.2 (admin members API + guard + tests + OpenAPI).

## Senior Developer Review (AI)

Date: 2026-01-09

### Findings

- [HIGH] La branche contient énormément de changements hors périmètre Story 1.2 (diff vs `main`). Recommandation: isoler cette story dans une PR dédiée ou documenter explicitement le scope élargi.
- [MEDIUM] Case-insensitive/idempotence sur l’invite: robustifié côté DB helper en réactivant d’abord une entrée existante via `lower(email)`.
- [MEDIUM] Couverture tests: ajout d’un test d’intégration “happy path” (admin) qui exerce GET/POST/PATCH avec DB stub.
- [LOW] Dedup du parsing token: extraction Bearer/cookie dans un helper partagé.

### Actions réalisées

- Ajout test d’intégration: `tests/integration/admin_members_happy_path.test.ts` + wiring dans `package.json`.
- Refactor token extraction: helper partagé `app/backend/lib/session_token.ts`, utilisé par routes admin + `/api/me`.
- Durcissement DB helper: `upsertInvite()` réactive d’abord une entrée existante case-insensitive, `setMemberActive()` devient idempotent sur `updated_at`.

### Review Follow-ups (AI)

- [ ] [AI-Review][HIGH] Réduire le scope de la branche/PR (isoler Story 1.2) ou documenter précisément pourquoi le diff contient autant de fichiers hors story.

### Change Log (Review)

- 2026-01-09: Revue AI + correctifs (tests happy path, refactor token, durcissement idempotence DB helper).
