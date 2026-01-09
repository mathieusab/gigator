# Story GIG-001: Démarrer le flux OAuth Gmail — POST /api/sync/gmail/start

Status: review

## Story

### Contexte produit (pourquoi)
Gigator doit permettre à l’équipe de piloter le workflow de booking depuis l’app (et pas “à côté” dans Gmail). La première brique est de pouvoir connecter une mailbox Gmail via OAuth afin d’activer la sync et les actions (labels, envoi).  
Sources:
- Ticket GIG-001 : [`docs/tickets.md`](docs/tickets.md:15)
- Vision intégration Gmail + fiabilité : [`_bmad-output/planning-artifacts/prd.md`](_bmad-output/planning-artifacts/prd.md:279)
- Fiabilité / pas de perte silencieuse + idempotence : [`_bmad-output/planning-artifacts/prd.md`](_bmad-output/planning-artifacts/prd.md:65)
- Contraintes OAuth/scopes + pattern watch→PubSub→history : [`_bmad-output/planning-artifacts/research/technical-integration-gmail-api-boite-mail-partagee-auth-scopes-sync-threads-pieces-jointes-audit-trail-research-2026-01-07.md`](_bmad-output/planning-artifacts/research/technical-integration-gmail-api-boite-mail-partagee-auth-scopes-sync-threads-pieces-jointes-audit-trail-research-2026-01-07.md:66)

### User story
As an utilisateur souhaitant connecter mon compte Gmail,  
I want que l’API me fournisse une URL de consentement Google (incluant `state`),  
so that je puisse rediriger l’utilisateur vers Google pour autoriser l’accès.

Source: [`docs/stories/GIG-001-story.md`](docs/stories/GIG-001-story.md:7)

### Portée (scope)
- Exposer l’endpoint **POST** `/api/sync/gmail/start`.
- Construire l’URL OAuth Google et renvoyer `{ oauth_url: string }`.
- Générer un paramètre `state` **cryptographiquement aléatoire**.
- Persister `state` côté serveur avec **TTL**, afin de pouvoir le valider au callback.

Sources:
- Ticket : [`docs/tickets.md`](docs/tickets.md:15)
- Story produit : [`docs/stories/GIG-001-story.md`](docs/stories/GIG-001-story.md:15)
- Notes techniques : [`docs/stories/GIG-001-dev.md`](docs/stories/GIG-001-dev.md:20)

### Hors scope (non-goals)
- Échange du `code` contre des tokens et persistance des tokens (c’est **GIG-002**): [`docs/tickets.md`](docs/tickets.md:28)
- Lancement du job d’import threads / sync incrémentale (c’est **GIG-003**): [`docs/tickets.md`](docs/tickets.md:42)
- Mise en place du watch Pub/Sub (déclenché plus tard; ici on démarre uniquement le consentement OAuth).

## Acceptance Criteria

AC1 — Contrat HTTP (succès)
1. `POST /api/sync/gmail/start` renvoie **200**.
2. Réponse JSON exacte: `{ "oauth_url": string }`.

Source: [`docs/stories/GIG-001-story.md`](docs/stories/GIG-001-story.md:16)

AC2 — Paramètres requis dans l’URL
1. `oauth_url` est une URL Google OAuth v2 qui **commence** par `https://accounts.google.com/o/oauth2/v2/auth?`.
2. `oauth_url` contient au minimum:
   - `client_id`
   - `redirect_uri`
   - `scope`
   - `response_type=code`
   - `state` (présent et non vide)

Source: [`docs/stories/GIG-001-story.md`](docs/stories/GIG-001-story.md:17)

AC3 — Erreurs de configuration (variables d’environnement)
1. Si les variables OAuth requises sont absentes, l’API renvoie **400 ou 500** (selon convention du backend) avec un message explicite.
2. La réponse d’erreur ne doit jamais inclure de secrets (ex: client_secret) ni de tokens.

Source: [`docs/stories/GIG-001-story.md`](docs/stories/GIG-001-story.md:19)

AC4 — Sécurité `state`
1. `state` est **unique** et **CSPRNG**.
2. `state` est persisté côté serveur avec **TTL** (min 10 minutes recommandé).
3. La persistance doit permettre une validation au callback (même si la validation est implémentée dans une story ultérieure, la donnée doit exister).

Sources:
- Story produit : [`docs/stories/GIG-001-story.md`](docs/stories/GIG-001-story.md:20)
- Options de persistance + TTL : [`docs/stories/GIG-001-dev.md`](docs/stories/GIG-001-dev.md:28)

## Scénarios de test (Given / When / Then)

T1 — Start OK
- Given que les variables d’environnement OAuth sont présentes,  
  When j’appelle `POST /api/sync/gmail/start`,  
  Then la réponse est 200 et contient `oauth_url` commençant par `https://accounts.google.com/o/oauth2/v2/auth?` et contenant `state=`.

Source: [`docs/stories/GIG-001-story.md`](docs/stories/GIG-001-story.md:23)

T2 — Start KO (config manquante)
- Given que des variables d’environnement OAuth sont manquantes,  
  When j’appelle `POST /api/sync/gmail/start`,  
  Then la réponse est une erreur (400/500 selon convention) avec un message clair.

Source: [`docs/stories/GIG-001-story.md`](docs/stories/GIG-001-story.md:27)

## Tasks / Subtasks (ordre obligatoire)

### Task 1 — Endpoint `POST /api/sync/gmail/start` (AC1, AC3)
- [x] Ajouter/valider la route Fastify pour `POST /api/sync/gmail/start` dans [`app/backend/routes/auth_google.ts`](app/backend/routes/auth_google.ts:1)
  - [x] Réponse succès: `{ oauth_url }` uniquement (AC1)
  - [x] Mapping d’erreur clair (AC3) et sans fuite d’infos sensibles

### Task 2 — Builder URL OAuth + génération `state` (AC2, AC4)
- [x] Réutiliser la logique existante de builder OAuth (ne pas réinventer) via [`getAuthUrl()`](app/backend/controllers/oauth.ts:42)
  - [x] Vérifier/assurer `response_type=code` (AC2)
  - [x] Générer `state` avec CSPRNG (AC4) (ex: `crypto.randomBytes(24).toString("hex")`)
  - [x] Injecter `state` dans l’URL
- [x] Valider la présence des env vars requises et lever une erreur explicite si manquantes (AC3)

Références: [`docs/stories/GIG-001-dev.md`](docs/stories/GIG-001-dev.md:14)

### Task 3 — Persistance `state` avec TTL (AC4)
- [x] Implémenter un store de `state` (reco: Redis) et persister avant de renvoyer l’URL
  - [x] Redis: clé `oauth:state:{state}` TTL (10 min–1h)
  - [x] Stocker un payload minimal (ex: `created_at`, `profile_id?`) uniquement
- [x] Ajouter/valider utilitaire de store dans [`app/backend/lib/oauth_state_store.ts`](app/backend/lib/oauth_state_store.ts:1)

Références:
- Options A/B : [`docs/stories/GIG-001-dev.md`](docs/stories/GIG-001-dev.md:28)
- Dépendance Redis présente : [`package.json`](package.json:20)

### Task 4 — Tests (AC1–AC4)
- [x] Test unitaire builder URL (présence des query params) dans [`tests/unit/oauth.builder.test.ts`](tests/unit/oauth.builder.test.ts:1)
  - [x] Vérifier que `state` est présent et a le format attendu (ex: hex de 48 chars si 24 bytes)
- [x] Test d’intégration endpoint `/start` dans [`tests/integration/oauth_start.test.ts`](tests/integration/oauth_start.test.ts:1)
  - [x] Vérifier `client_id`, `redirect_uri`, `response_type`, `scope`, `state` dans l’URL
- [x] S’assurer que les scripts de test de repo restent verts : [`package.json`](package.json:4)

Référence: [`docs/stories/GIG-001-dev.md`](docs/stories/GIG-001-dev.md:54)

### Task 5 — Documentation OpenAPI (AC1–AC3)
- [x] Mettre à jour la spec OpenAPI pour `/api/sync/gmail/start` dans [`app/backend/openapi.yaml`](app/backend/openapi.yaml:1)
  - [x] Ajouter exemple de response 200
  - [x] Documenter erreurs 400/500 (payload aligné sur l’impl)

Références: [`docs/stories/GIG-001-dev.md`](docs/stories/GIG-001-dev.md:18)

## Dev Notes (guardrails anti-erreurs)

### Stack & conventions à respecter (ne pas changer sans story)
- Backend: Fastify (dépendance) : [`package.json`](package.json:20)
- DB: `pg` (si option DB retenue) : [`package.json`](package.json:21)
- Redis disponible (recommandé pour TTL) : [`package.json`](package.json:23)

### Sécurité (obligatoire)
- Ne jamais logger ni renvoyer au client des secrets OAuth ou des tokens.  
  Rappel: même les bodies d’erreurs “upstream Google” peuvent contenir des infos sensibles → ne pas les refléter tels quels.

Source: [`docs/stories/GIG-001-dev.md`](docs/stories/GIG-001-dev.md:56)

### Cohérence produit/UX
- Ce endpoint sert à initier un flux critique “connexion Gmail” ; en cas d’échec, l’UX attend une erreur actionnable (message explicite + voie de recovery).  
  Référence UX générale (erreurs/recovery): [`_bmad-output/planning-artifacts/ux-design-specification.md`](_bmad-output/planning-artifacts/ux-design-specification.md:134)

### Idempotence & fiabilité
- Même si `/start` est “simple”, la persistance `state` doit être robuste (TTL + store fiable) car c’est un point de sécurité (CSRF / replay).  
  Contexte “fiabilité sync & actions” : [`_bmad-output/planning-artifacts/prd.md`](_bmad-output/planning-artifacts/prd.md:65)

### Project Structure Notes
- Les fichiers backend sont attendus sous [`app/backend/`](app/backend/:1) (routes, controllers, lib).
- Les tests sont exécutés via scripts racine: [`package.json`](package.json:4)

### References
- Story produit : [`docs/stories/GIG-001-story.md`](docs/stories/GIG-001-story.md:1)
- Dev story (ready-for-dev/QA) : [`docs/stories/GIG-001-dev.md`](docs/stories/GIG-001-dev.md:1)
- Ticket source : [`docs/tickets.md`](docs/tickets.md:15)
- Architecture high-level : [`ARCHITECTURE.md`](ARCHITECTURE.md:1)
- PRD : [`_bmad-output/planning-artifacts/prd.md`](_bmad-output/planning-artifacts/prd.md:1)
- Research Gmail/OAuth : [`_bmad-output/planning-artifacts/research/technical-integration-gmail-api-boite-mail-partagee-auth-scopes-sync-threads-pieces-jointes-audit-trail-research-2026-01-07.md`](_bmad-output/planning-artifacts/research/technical-integration-gmail-api-boite-mail-partagee-auth-scopes-sync-threads-pieces-jointes-audit-trail-research-2026-01-07.md:1)
- UX Spec : [`_bmad-output/planning-artifacts/ux-design-specification.md`](_bmad-output/planning-artifacts/ux-design-specification.md:1)

## Dev Agent Record

### Agent Model Used
gpt-5.2 (bmad-bmm-sm)

### Debug Log References
- `npm test` OK (suite complète): [`package.json`](package.json:10)
- `npm run lint` OK (typecheck): [`package.json`](package.json:9)
- Aucun `project-context.md` détecté via `find . -name project-context.md` (output vide)

### Completion Notes List
- Implémentation de `POST /api/sync/gmail/start` : renvoie `{ oauth_url }` et gère erreurs de config vs erreur inattendue : [`authGoogleRoutes()`](app/backend/routes/auth_google.ts:48)
- Builder OAuth: génération `state` CSPRNG (24 bytes hex) + construction URL via `URLSearchParams` : [`getAuthUrl()`](app/backend/controllers/oauth.ts:68)
- Persistance `state` avec TTL (Redis si `REDIS_URL`, fallback mémoire) + lecture/suppression one-shot au callback : [`persistOauthState()`](app/backend/lib/oauth_state_store.ts:67), [`getOauthState()`](app/backend/lib/oauth_state_store.ts:93), [`deleteOauthState()`](app/backend/lib/oauth_state_store.ts:127)
- OpenAPI mis à jour avec examples 200/400/500 : [`app/backend/openapi.yaml`](app/backend/openapi.yaml:128)
- Tests ajoutés/renforcés (unit + intégration) et verts : [`tests/unit/oauth.builder.test.ts`](tests/unit/oauth.builder.test.ts:1), [`tests/integration/oauth_start.test.ts`](tests/integration/oauth_start.test.ts:1), [`tests/integration/oauth_callback_state.test.ts`](tests/integration/oauth_callback_state.test.ts:1)

### File List
- Routes: [`app/backend/routes/auth_google.ts`](app/backend/routes/auth_google.ts:1)
- Controller/builder: [`app/backend/controllers/oauth.ts`](app/backend/controllers/oauth.ts:1)
- Store state: [`app/backend/lib/oauth_state_store.ts`](app/backend/lib/oauth_state_store.ts:1)
- OpenAPI: [`app/backend/openapi.yaml`](app/backend/openapi.yaml:1)
- Unit test: [`tests/unit/oauth.builder.test.ts`](tests/unit/oauth.builder.test.ts:1)
- Integration test: [`tests/integration/oauth_start.test.ts`](tests/integration/oauth_start.test.ts:1)

## Change Log
- 2026-01-09 — Validation story: tests + lint OK, Status → review (AC1–AC4 + OpenAPI).