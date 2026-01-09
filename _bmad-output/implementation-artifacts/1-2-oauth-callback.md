# Story 1.2 (alias): OAuth callback code exchange — GET /api/sync/gmail/callback

Status: review
Story Key: 1-2-oauth-callback

> Note: ce fichier existait avec un encodage corrompu (détecté comme binaire). Il a été reconstruit en Markdown UTF-8.
> Le contenu canonique équivalent est aussi disponible dans `_bmad-output/implementation-artifacts/GIG-002-oauth-callback.md`.

## Story
En tant qu’utilisateur qui vient d’autoriser l’accès Gmail,
je veux que le backend échange le `code` OAuth, valide/consomme le `state`, et persiste les tokens de manière sûre,
afin que la sync puisse démarrer sans exposer de secrets côté client.

## Acceptance Criteria
1. `GET /api/sync/gmail/callback` échange `code -> tokens` et renvoie uniquement des champs safe (`id`, `email`, `display_name`, `expires_at`) — jamais `refresh_token`.
2. Les tokens sont persistés en DB (`gmail_accounts`) avec `access_token`, `refresh_token` (si fourni), `expires_at`; une entrée `gmail_import_runs` est créée avec `status = created`.
3. Gestion d’erreurs:
   - `code` manquant/invalide -> `400`
   - `state` invalide/expiré/inconnu -> `400` (`invalid_oauth_state`)
   - échec d’échange auprès de Google -> `500` avec message stable (sans fuite de détails upstream)
4. Aucune fuite de secrets: tokens jamais loggués, jamais renvoyés au client.

## Tasks / Subtasks
- [x] Implémenter `GET /api/sync/gmail/callback` (route) et clarifier les réponses `200/400/500`.
- [x] Implémenter l’échange `code -> tokens` (controller/service) + calcul `expires_at`.
- [x] Persister `gmail_accounts` (upsert idempotent) + créer `gmail_import_runs` (status `created`).
- [x] Valider et consommer le `state` en one-shot via `app/backend/lib/oauth_state_store.ts`.
- [x] Sanitize logs + réponse: ne jamais inclure `access_token`/`refresh_token`.
- [x] Mettre à jour OpenAPI pour l’endpoint callback.
- [x] Tests: happy path + invalid state + erreurs d’échange (provider mock).

## Références
- Story canonique: `_bmad-output/implementation-artifacts/GIG-002-oauth-callback.md`
- OAuth start: `_bmad-output/implementation-artifacts/GIG-001-oauth-start.md`

## Dev Agent Record
### Agent Model Used
GPT-5.2

### Completion Notes
- Aligne la réponse de `GET /api/sync/gmail/callback` sur l’AC: payload strictement `{ id, email, display_name, expires_at }`.
- Clarifie `400 missing_code` avec `{ error, message }`.
- Ajoute un test d’intégration happy path avec mocks provider + DB stub.
- Validation: `npm test`, `npm run lint`.

## File List
- Modifié : app/backend/controllers/oauth.ts
- Modifié : app/backend/routes/auth_google.ts
- Modifié : app/backend/openapi.yaml
- Ajouté : tests/integration/oauth_callback_happy_path.test.ts
- Modifié : package.json

## Change Log
- 2026-01-09: Callback Gmail OAuth — réponse + OpenAPI + tests (happy path).
