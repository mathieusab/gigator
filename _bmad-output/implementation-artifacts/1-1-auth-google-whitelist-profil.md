# Story 1.1: Authentification Google + whitelist + profil

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a utilisateur,
I want me connecter via Google Login et accéder à mon profil,
so that je puisse utiliser Gigator en toute sécurité.

## Acceptance Criteria

1. **Given** je suis sur l’écran de login
   **When** je me connecte avec un compte Google autorisé (whitelist)
   **Then** je suis authentifié et redirigé vers l’application
   **And** mon profil (email, nom) est accessible depuis un écran dédié

2. **Given** j’essaie de me connecter avec un email non autorisé
   **When** la vérification whitelist échoue
   **Then** l’accès est refusé avec un message clair

## Tasks / Subtasks

- [x] Implémenter la base “Auth Google (app)” côté backend
  - [x] Ajouter un nouveau module de routes Fastify dédié (ex: `app/backend/routes/auth_app_google.ts`) distinct des routes Gmail (`/api/sync/gmail/*`) pour éviter les confusions de scopes et de persistance
  - [x] Ajouter un contrôleur dédié (ex: `app/backend/controllers/auth_app.ts`) qui construit l’URL OAuth avec scopes minimaux `openid email profile`
  - [x] Réutiliser `app/backend/lib/oauth_state_store.ts` pour générer/persister/valider le `state` (CSRF), avec usage “one-time” (delete dès validation)

- [x] Définir la whitelist (MVP) et la vérification d’autorisation (AC #2)
  - [x] Créer une table d’allowlist (ou utiliser un équivalent existant) pour stocker les emails autorisés et leur statut actif/inactif
  - [x] Ajouter une requête DB pour vérifier `email` ∈ whitelist et `is_active=true` avant d’établir une session
  - [x] Retourner une réponse 403 stable (ex: `{ error: "access_denied" }`) quand l’email n’est pas autorisé

- [x] Finaliser le callback OAuth “app login”
  - [x] Implémenter `GET /api/auth/google/callback` (nouvelle route app, pas Gmail) : échange du `code` contre tokens, fetch userinfo Google, extraction `{ sub, email, name, picture }`
  - [x] Ne jamais logger/retourner de tokens (suivre le pattern de redaction/sanitization déjà présent dans `app/backend/routes/auth_google.ts`)
  - [x] Upsert du profil applicatif (table `profiles` du schéma) avec `email/full_name/avatar_url` (et si besoin `auth_uid` ou un champ `google_user_id`)

- [x] Mettre en place une session minimale
  - [x] Choisir et documenter l’approche :
    - JWT Bearer (aligné avec `components.securitySchemes.bearerAuth` dans `app/backend/openapi.yaml`), OU
    - cookie `httpOnly` signé
  - [x] Implémenter un mécanisme d’auth pour les routes protégées (ex: `GET /api/me`) sans introduire de complexité “refresh token” dans cette story

- [x] Exposer un endpoint “profil” (AC #1)
  - [x] Ajouter `GET /api/me` : retourne `{ id, email, full_name, avatar_url }` du profil courant
  - [x] S’assurer qu’une demande non authentifiée reçoit un 401 stable

- [x] Mettre à jour l’OpenAPI
  - [x] Documenter `GET /api/auth/google/start` (ou `POST` selon choix), `GET /api/auth/google/callback`, `GET /api/me`
  - [x] Ajouter les schémas d’erreur (`access_denied`, `invalid_oauth_state`, `oauth_config_error`) et la sécurité (bearerAuth si JWT)

- [x] Tests (in-process) alignés avec les patterns existants
  - [x] Ajouter un test d’intégration qui vérifie que l’URL OAuth “app” inclut les scopes minimaux (sans Gmail)
  - [x] Ajouter un test d’intégration pour `invalid_oauth_state` (callback sans state ou state inconnu → 400)
  - [x] Ajouter un test d’intégration “deny” (email hors whitelist → 403)
  - [x] Garder le pattern `fastify.inject` + import cache-bust comme dans `tests/integration/oauth_start.test.ts`

## Dev Notes

- **Ne pas réinventer** : réutiliser la mécanique de `state` existante (`app/backend/lib/oauth_state_store.ts`) et les patterns de sanitization/log safety de `app/backend/routes/auth_google.ts`.
- **Séparation des scopes** : l’OAuth Gmail (import/sync) et l’OAuth “login app” doivent rester séparés (routes, scopes, persistence). L’auth app ne doit pas demander des scopes Gmail.
- **DB** : le schéma Supabase/PG “Gigator” inclut `profiles` (voir `db/schema.sql`). Utiliser `profiles` comme source de vérité du profil utilisateur.
- **Sécurité** :
  - state obligatoire et consommé une seule fois
  - ne jamais renvoyer/insérer `id_token` ou `access_token` côté client sans nécessité
  - erreurs stables et “safe to expose”

### Project Structure Notes

- Backend routes existantes : `app/backend/routes/auth_google.ts` (Gmail OAuth PoC)
- Contrôleurs existants : `app/backend/controllers/oauth.ts`
- Lib existante : `app/backend/lib/oauth_state_store.ts`
- Spéc API : `app/backend/openapi.yaml`

### References

- Epics/stories: `_bmad-output/planning-artifacts/epics.md` → “Story 1.1: Authentification Google + whitelist + profil”
- Architecture: `ARCHITECTURE.md` (auth OAuth2 + Google sign-in)
- Schéma DB: `db/schema.sql` (table `profiles`)

## Dev Agent Record

### Agent Model Used

GPT-5.2

### Debug Log References

- N/A (story prep only)

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- 2026-01-09: Implémentation backend OAuth "app login" + allowlist + session JWT + endpoint /api/me. Tests in-process + unit ajoutés.

### File List

- app/backend/controllers/auth_app.ts
- app/backend/lib/allowlist.ts
- app/backend/lib/jwt.ts
- app/backend/routes/auth_app_google.ts
- app/backend/routes/me.ts
- app/backend/openapi.yaml
- db/migrations/0002_create_app_email_allowlist.sql
- db/migrations/0003_add_profiles_google_user_id.sql
- db/schema.sql
- tests/integration/auth_app_oauth_start.test.ts
- tests/integration/auth_app_oauth_callback_state.test.ts
- tests/integration/auth_app_oauth_callback_success.test.ts
- tests/integration/auth_app_oauth_deny_allowlist.test.ts
- tests/integration/me.test.ts
- tests/unit/allowlist.env.test.ts
- tests/unit/allowlist.test.ts
- package.json
- _bmad-output/implementation-artifacts/1-1-auth-google-whitelist-profil.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-01-09: Ajout OAuth login app (start/callback), allowlist, JWT + /api/me, OpenAPI + tests.

## Senior Developer Review (AI)

Date: 2026-01-09

Fixes applied (post-review):
- OpenAPI: suppression du `security` global pour éviter de protéger par défaut les endpoints publics; ajout d’exemples/erreurs manquants.
- Auth: validation stricte du `state` (type + existence + flow `app_login`), erreurs moins fragiles.
- Allowlist: optimisation perf via index fonctionnel `lower(email)` + paramètre normalisé; ajout tests env.
- Session: option redirect post-login via cookie HttpOnly (si `APP_OAUTH_SUCCESS_REDIRECT_URI` est défini) tout en conservant la réponse JSON par défaut.
- Tests: ajout d’un test d’intégration “callback success” avec stubs fetch + pg.


Status: review
