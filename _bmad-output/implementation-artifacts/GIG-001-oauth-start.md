# Story 1.1: Demarrer le flux OAuth Gmail - POST /api/sync/gmail/start

Status: done
Story Key: GIG-001-oauth-start

## Story
As an utilisateur souhaitant connecter mon compte Gmail,
I want que l'API fournisse une URL de consentement Google incluant state,
so that je puisse rediriger l'utilisateur vers Google pour autoriser l'acces.

## Acceptance Criteria
1. POST /api/sync/gmail/start renvoie 200 avec JSON { oauth_url: string }.
2. oauth_url commence par https://accounts.google.com/o/oauth2/v2/auth? et contient client_id, redirect_uri, scope, response_type=code et state non vide.
3. Si des variables OAuth manquent, la route renvoie 400 ou 500 avec message explicite sans fuite de secrets.
4. state est genere par CSPRNG, unique, et persiste cote serveur avec TTL (>=10 min) pour validation au callback.

## Tasks / Subtasks
- [x] Exposer POST /api/sync/gmail/start dans [app/backend/routes/auth_google.ts](app/backend/routes/auth_google.ts) et retourner exactement { oauth_url }.
- [x] Valider la presence des variables d'environnement OAuth et mapper les erreurs 400/500 sans secrets.
- [x] Generer state via crypto.randomBytes(24).toString("hex") et l'injecter dans l'URL dans [app/backend/controllers/oauth.ts](app/backend/controllers/oauth.ts).
- [x] Persister state avec TTL (Redis recommande) via [app/backend/lib/oauth_state_store.ts](app/backend/lib/oauth_state_store.ts); fallback memoire tolere en dev.
- [x] Mettre a jour la spec [app/backend/openapi.yaml](app/backend/openapi.yaml) pour le succes 200 et les erreurs 400/500 avec exemple de reponse.
- [x] Tests: unit builder (params et format state) dans [tests/unit/oauth.builder.test.ts](tests/unit/oauth.builder.test.ts) et integration POST /api/sync/gmail/start dans [tests/integration/oauth_start.test.ts](tests/integration/oauth_start.test.ts).

## Developer Context and Guardrails
- Stack backend: Node/TypeScript + Fastify; respecter la structure sous app/backend (routes, controllers, lib).
- Securite: ne jamais logguer ni renvoyer secrets OAuth ou tokens; ne pas refleter les erreurs Google brutes; state doit etre consommable au callback (persiste + TTL).
- Persistence: Redis preferee pour TTL court; si REDIS_URL absent, fallback in-memory acceptable pour dev mais documenter.
- Contract d'erreur: payload clair (ex: { error, message }); pas de stacktrace en reponse; distinguer config manquante (400) vs erreur serveur (500).
- Architecture reference: voir [ARCHITECTURE.md](ARCHITECTURE.md) et le focus fiabilite sync / actions Gmail (PRD) dans [_bmad-output/planning-artifacts/prd.md](_bmad-output/planning-artifacts/prd.md).
- Tests et qualite: executer npm test et npm run lint avant remise; couvrir au minimum les AC listes.

### Project Structure Notes
- Routes Fastify: [app/backend/routes/auth_google.ts](app/backend/routes/auth_google.ts)
- Controleur/builder OAuth: [app/backend/controllers/oauth.ts](app/backend/controllers/oauth.ts)
- Store de state: [app/backend/lib/oauth_state_store.ts](app/backend/lib/oauth_state_store.ts)
- OpenAPI: [app/backend/openapi.yaml](app/backend/openapi.yaml)
- Tests: [tests/unit/oauth.builder.test.ts](tests/unit/oauth.builder.test.ts), [tests/integration/oauth_start.test.ts](tests/integration/oauth_start.test.ts)

### References
- Story produit: [docs/stories/GIG-001-story.md](docs/stories/GIG-001-story.md)
- Story dev (guides techniques): [docs/stories/GIG-001-dev.md](docs/stories/GIG-001-dev.md)
- Ticket source: [docs/tickets.md](docs/tickets.md#L15)
- AC globaux: [docs/acceptance_criteria_and_tests.md](docs/acceptance_criteria_and_tests.md#L12)
- PRD: [_bmad-output/planning-artifacts/prd.md](_bmad-output/planning-artifacts/prd.md)
- Architecture: [ARCHITECTURE.md](ARCHITECTURE.md)

## Dev Agent Record
### Agent Model Used
GPT-5.2

### Completion Notes
- Verifie que l'endpoint POST /api/sync/gmail/start retourne exactement { oauth_url } et que l'URL contient client_id / redirect_uri / response_type=code / scope / state.
- Verifie que les erreurs de config OAuth renvoient 400 avec payload explicite sans fuite de secrets.
- Verifie generation state via CSPRNG (24 bytes hex) et persistence avec TTL (>= 10 min) avec fallback memoire quand REDIS_URL absent.
- Tests executes et verts: `npm test` (unit oauth.builder + integration oauth_start + oauth_callback_state), `npm run lint` (tsc).

## Senior Developer Review (AI)
- Resultat: OK et valide apres corrections mineures (securite + robustesse).
- Corrections appliquees:
	- TTL minimum impose a 10 minutes pour le store de state.
	- Erreurs de config OAuth typées (classification 400 plus robuste, sans parsing fragile du message).
	- Redaction renforcee dans les logs (masquage des credentials embarques dans les URLs type redis://user:pass@host).
	- Purge des entrees expirees pour le fallback memoire.
- Verification: `npm test` et `npm run lint` OK.

## File List
- app/backend/routes/auth_google.ts
- app/backend/controllers/oauth.ts
- app/backend/lib/oauth_state_store.ts
- app/backend/openapi.yaml
- tests/unit/oauth.builder.test.ts
- tests/integration/oauth_start.test.ts
- _bmad-output/implementation-artifacts/GIG-001-oauth-start.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log
- 2026-01-09: Validation complete (tests + typecheck) et passage en status `review`.
- 2026-01-09: Code review: corrections appliquees, story marquee `done` (validee).
