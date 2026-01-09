# Dev Story — GIG-001 : Implémentation technique (POST /api/sync/gmail/start)

Epic: Auth & Gmail sync
Priority: P0
Estimation: S
Status: Ready for QA (CI ✅)

But: cette story est la version "ready for dev" — instructions concrètes, fichiers à modifier, tests et migration.

Résumé
- Implémenter l'endpoint POST /api/sync/gmail/start qui renvoie { oauth_url } construit par le backend.
- S'assurer que le paramètre `state` est cryptographiquement sécurisé, persistant temporairement avec TTL, et que la story/documentation/OpenAPI sont à jour.

Références existantes
- Implementation actuelle du builder OAuth : [`getAuthUrl()`](app/backend/controllers/oauth.ts:42)
- Routes Fastify PoC : [`app/backend/routes/auth_google.ts`](app/backend/routes/auth_google.ts:1)
- Service d'import lié : [`app/backend/services/gmail_import.ts`](app/backend/services/gmail_import.ts:1)
- OpenAPI actuel : [`app/backend/openapi.yaml`](app/backend/openapi.yaml:128)

Objectifs techniques
1. Garantir que le endpoint POST /api/sync/gmail/start retourne 200 { "oauth_url": string } construit depuis le serveur.
2. Générer un `state` sécurisé (ex: 24+ bytes via crypto.randomBytes) et persister ce state avec TTL (recommandé: Redis ou table DB avec expiry). Le state doit pouvoir être validé au callback.
3. Ajouter tests unitaires pour la fonction de construction d'URL et tests d'intégration pour l'endpoint.
4. Mettre à jour OpenAPI pour documenter l'endpoint et l'exemple de réponse.
5. Ajouter migration si on choisit une table DB (option Redis vs DB expliquée ci-dessous).

Décisions d'architecture (choix à faire)
- Persistance de `state`:
  - Option A (recommandée pour simplicité/performances): Redis key `oauth:state:{state}` -> value { profileId?, created_at } TTL 10m–1h.
  - Option B (si pas de Redis): DB table `oauth_states(id text primary key, profile_id text, created_at timestamptz, ttl_seconds int)` + background job purge ou utiliser DB interval.
- TTL proposé: 10 minutes minimum, 1 hour safe. Documenter dans la story.

Fichiers à modifier / créer
- Modifier : [`app/backend/controllers/oauth.ts`](app/backend/controllers/oauth.ts:1) — extraire la génération/persistance du `state` et renvoyer l'URL + state (actuellement `getAuthUrl()` construit et retourne URL, ajouter hook pour persistance).
  - Ajouter (ou appeler) utilitaire : [`persistOauthState(state: string, meta?: any)`](app/backend/controllers/oauth.ts:55)
- Modifier : [`app/backend/routes/auth_google.ts`](app/backend/routes/auth_google.ts:1) — endpoint POST déjà présent; s'assurer qu'il renvoie précisément { oauth_url } et gérer erreurs (500/400) de façon claire.
- Modifier : [`app/backend/openapi.yaml`](app/backend/openapi.yaml:128) — ajouter description, exemple response 200 et préciser erreurs 400/500.
- Créer tests unitaires : `tests/unit/oauth.builder.test.ts` — tester que [`getAuthUrl()`](app/backend/controllers/oauth.ts:42) contient les params attendus (client_id, redirect_uri, response_type=code, scope, state).
- Créer tests d'intégration : `tests/integration/oauth_start.test.js` — lancer app (ou stub fastify) et appeler POST /api/sync/gmail/start pour valider réponse 200 et format d'oauth_url (commence par "https://accounts.google.com/o/oauth2/v2/auth?" et contient "state=").
- Si persistance DB choisie : ajouter migration `db/migrations/000X_create_oauth_states.sql`.
- Si Redis choisi : ajouter utilitaire `app/backend/lib/redis.ts` (si pas déjà présent) et tests mocks.

Tâches détaillées (ordre d'exécution)
1. Implémenter persistance de state (choix Redis/DB) — créer utilitaire de lecture/écriture avec TTL.
   - File suggestion: [`app/backend/lib/oauth_state_store.ts`](app/backend/lib/oauth_state_store.ts:1) (ou utiliser existing redis lib).
2. Refactor [`getAuthUrl()`](app/backend/controllers/oauth.ts:42) pour:
   - Générer `state`.
   - Persister `state` via le store.
   - Retourner l'URL (conservant l'implémentation actuelle) — laisser `getAuthUrl()` retourner string, mais ajouter option pour retourner object { oauth_url, state } si utile.
   - Mettre à jour les appels dans [`app/backend/routes/auth_google.ts`](app/backend/routes/auth_google.ts:25) pour s'aligner sur le nouveau retour.
3. Mettre à jour route `POST /api/sync/gmail/start` pour:
   - Appeler `getAuthUrl()` et renvoyer { oauth_url }.
   - Logger les erreurs et renvoyer codes d'erreur clairs (400 pour erreurs de config, 500 pour autres).
4. Ajouter tests unitaires et d'intégration.
5. Mettre à jour OpenAPI : ajouter example response 200 et documenter erreurs 400, 500.
6. Revue de sécurité (obligatoire):
   - Ne jamais logguer ni renvoyer au client `refresh_token` ni `id_token` (y compris indirectement via `err.message` / `stack`).
     - À appliquer aux routes Fastify (ex: [`app/backend/routes/auth_google.ts`](app/backend/routes/auth_google.ts:1)) ET aux services (ex: [`app/backend/services/gmail_import.ts`](app/backend/services/gmail_import.ts:1)).
   - Interdire l’echo d’erreurs “upstream” (Google) dans les réponses HTTP (les bodies provider peuvent contenir des infos sensibles).
   - `state`:
     - Entropie minimale: 24 bytes CSPRNG (`crypto.randomBytes(24)`) → 48 chars hex (voir [`crypto.randomBytes(24)`](app/backend/controllers/oauth.ts:74)).
     - Stockage avec TTL (10min par défaut OK) et validation au callback (reject si absent/expiré).
     - Verrouiller par un test (ex: regex `/^[0-9a-f]{48}$/i`) — voir [`tests/unit/oauth.builder.test.ts`](tests/unit/oauth.builder.test.ts:1).
7. CI: exécuter tests, vérifier lint, vérifier qu'aucune clé sensible n'est dans le repo.
8. ✅ Story marquée "ready for QA" (CI vert).

Exemples de snippets (pour dev rapide)
- Génération state (déjà en PoC) : [`getAuthUrl()`](app/backend/controllers/oauth.ts:55-70) utilise:
  - crypto.randomBytes(12).toString('hex') -> augmenter à 24 bytes: crypto.randomBytes(24).toString('hex')
- Persistance Redis (pseudo):
  - setex(`oauth:state:${state}`, ttlSeconds, JSON.stringify({ created_at: Date.now(), profile_id }))
- Validation au callback (dans [`handleOAuthCallback()`](app/backend/controllers/oauth.ts:74)):
  - vérifier que `state` existe dans le store et n'a pas expiré; si absent -> reject 400.

OpenAPI (à ajouter)
- Dans [`app/backend/openapi.yaml`](app/backend/openapi.yaml:128) remplacer / compléter la spec:
  - responses:
    '200':
      description: OAuth URL returned
      content:
        application/json:
          example:
            oauth_url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=...&state=..."
    '400':
      description: Bad request / missing config or invalid params
    '500':
      description: Server error

Critères d'acceptation technique (DA)
- Endpoint POST /api/sync/gmail/start renvoie 200 et JSON { oauth_url: string }.
- oauth_url contient client_id, redirect_uri, scope, response_type=code et state.
- state est persisté dans le store choisi et a TTL.
- Tests unitaires et d'intégration passent en CI.
- OpenAPI mis à jour avec exemple.

Notes / risques
- Si Redis n'existe pas dans infra dev/staging, préférer DB table mais documenter pourquoi (Redis recommandé).
- Ne pas exposer refresh_token ni tokens dans logs/réponses.
- Gérer correctement l'horloge/expirations pour éviter états persistants trop longs.

Assignation & estimation
- Développeur: (laisser vide / assigner équipe)
- Estimation: 2-4 heures (PoC + tests + OpenAPI update)

Créé à partir de la story produit : [`docs/stories/GIG-001-story.md`](docs/stories/GIG-001-story.md:1)

---

## Senior Developer Review (AI) — 2026-01-08

### Résumé (verdict)
**Changes requested → FIXED.** Les points bloquants identifiés pendant la revue ont été corrigés, et la suite de tests passe.

### Findings (avant corrections)
- **HIGH** — `state` persisté mais non validé au callback (risque CSRF / replay) : [`handleOAuthCallback()`](app/backend/controllers/oauth.ts:103).
- **HIGH** — Contrat erreur non conforme (OpenAPI vs runtime) : [`app/backend/openapi.yaml`](app/backend/openapi.yaml:128) vs [`authGoogleRoutes()`](app/backend/routes/auth_google.ts:48).
- **MEDIUM** — Test d’intégration trop faible (ne valide pas les query params requis) : [`tests/integration/oauth_start.test.ts`](tests/integration/oauth_start.test.ts:7).
- **MEDIUM** — “Redis preferred” sans dépendance `redis` déclarée : [`oauth_state_store.ts`](app/backend/lib/oauth_state_store.ts:1).
- **LOW/MEDIUM** — Side effects au chargement du module DB pool : [`app/backend/controllers/oauth.ts`](app/backend/controllers/oauth.ts:38).

### Correctifs appliqués
- Validation + consommation one-shot du `state` dans le callback (reject si absent/expiré/inconnu) :
  - [`handleOAuthCallback()`](app/backend/controllers/oauth.ts:103)
  - store: [`getOauthState()`](app/backend/lib/oauth_state_store.ts:96), [`deleteOauthState()`](app/backend/lib/oauth_state_store.ts:130)
- Alignement des payloads d’erreur `{ error, message }` sur `/start` + mapping `invalid_oauth_state` sur 400 au callback :
  - [`app/backend/routes/auth_google.ts`](app/backend/routes/auth_google.ts:50)
- OpenAPI aligné sur l’impl (redirect_uri `/api/sync/gmail/callback` + exemples d’erreurs) :
  - [`app/backend/openapi.yaml`](app/backend/openapi.yaml:128)
- Tests renforcés :
  - `/start` vérifie maintenant `client_id`, `redirect_uri`, `response_type`, `scope`, `state` : [`tests/integration/oauth_start.test.ts`](tests/integration/oauth_start.test.ts:7)
  - Nouveau test callback state (missing/unknown = 400, valid state consommé même si exchange échoue ensuite) :
    [`tests/integration/oauth_callback_state.test.ts`](tests/integration/oauth_callback_state.test.ts:1)
- Support Redis rendu réel : ajout dépendance `redis` dans [`package.json`](package.json:1) (lockfile mis à jour) et typage du store :
  - [`app/backend/lib/oauth_state_store.ts`](app/backend/lib/oauth_state_store.ts:1)
- Pool PG lazy-init pour éviter effets de bord sur `/start` :
  - [`app/backend/controllers/oauth.ts`](app/backend/controllers/oauth.ts:38)

### Tests exécutés
- `npm test` (OK) — voir scripts : [`package.json`](package.json:10)

### File List (modifiés / ajoutés)
- Modifié : [`app/backend/controllers/oauth.ts`](app/backend/controllers/oauth.ts:1)
- Modifié : [`app/backend/routes/auth_google.ts`](app/backend/routes/auth_google.ts:1)
- Modifié : [`app/backend/openapi.yaml`](app/backend/openapi.yaml:1)
- Modifié : [`app/backend/lib/oauth_state_store.ts`](app/backend/lib/oauth_state_store.ts:1)
- Modifié : [`package.json`](package.json:1)
- Modifié : [`package-lock.json`](package-lock.json:1)
- Modifié : [`tests/integration/oauth_start.test.ts`](tests/integration/oauth_start.test.ts:1)
- Ajouté : [`tests/integration/oauth_callback_state.test.ts`](tests/integration/oauth_callback_state.test.ts:1)

### Change Log
- 2026-01-08 — Code review adversarial + correctifs (state validation, error contract, OpenAPI, tests, Redis dep, lazy DB pool).
