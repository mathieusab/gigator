# Story 1.1: Demarrer le flux OAuth Gmail - POST /api/sync/gmail/start

Status: ready-for-dev
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
- [ ] Exposer POST /api/sync/gmail/start dans [app/backend/routes/auth_google.ts](app/backend/routes/auth_google.ts) et retourner exactement { oauth_url }.
- [ ] Valider la presence des variables d'environnement OAuth et mapper les erreurs 400/500 sans secrets.
- [ ] Generer state via crypto.randomBytes(24).toString("hex") et l'injecter dans l'URL dans [app/backend/controllers/oauth.ts](app/backend/controllers/oauth.ts).
- [ ] Persister state avec TTL (Redis recommande) via [app/backend/lib/oauth_state_store.ts](app/backend/lib/oauth_state_store.ts); fallback memoire tolere en dev.
- [ ] Mettre a jour la spec [app/backend/openapi.yaml](app/backend/openapi.yaml) pour le succes 200 et les erreurs 400/500 avec exemple de reponse.
- [ ] Tests: unit builder (params et format state) dans [tests/unit/oauth.builder.test.ts](tests/unit/oauth.builder.test.ts) et integration POST /api/sync/gmail/start dans [tests/integration/oauth_start.test.ts](tests/integration/oauth_start.test.ts).

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
GPT-5.1-Codex-Max

### Completion Notes
- Story marquee ready-for-dev avec AC + taches techniques alignees sur la spec.
- Assurez-vous que la persistance state inclut TTL et qu'une validation au callback sera possible (scindee dans GIG-002 si besoin).
- OpenAPI et tests doivent etre tenus en phase avec l'implementation.