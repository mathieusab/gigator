# Acceptance criteria & Scénarios de test — Gigator (FR)

Références rapides
- Architecture: [`ARCHITECTURE.md`](ARCHITECTURE.md:1)  
- Spécification API (OpenAPI): [`app/backend/openapi.yaml`](app/backend/openapi.yaml:1)  
- PoC Gmail import: [`app/backend/services/gmail_import.ts`](app/backend/services/gmail_import.ts:1)  
- OAuth routes PoC: [`app/backend/routes/auth_google.ts`](app/backend/routes/auth_google.ts:1) / [`app/backend/controllers/oauth.ts`](app/backend/controllers/oauth.ts:1)

Mode d'emploi
- Pour chaque story ci‑dessous : Critères d'acceptation (AC) et Scénarios de test (Gherkin-like / Given-When-Then). Indique si le test est unit, integration (API) ou end-to-end (E2E/UI).

-----------------------------------------------------------------------
EPIC 1 — Auth & Gmail sync
But : Lier un compte Google, stocker tokens et importer threads.

Story 1.1 — Démarrer le flux OAuth (endpoint /api/sync/gmail/start)
- AC:
  - L'endpoint POST /api/sync/gmail/start renvoie 200 avec { oauth_url: string }.
  - L'URL contient client_id, redirect_uri, scope, response_type et state.
  - Un "state" aléatoire est généré côté serveur.
  - Erreurs configurables renvoient 500 avec message standard.
- Tests:
  - Integration: Appeler POST /api/sync/gmail/start
    - Given que les vars d'env nécessaires sont définies,
    - When j'appelle l'endpoint,
    - Then la réponse contient oauth_url commençant par "https://accounts.google.com/o/oauth2/v2/auth?" et contenant "state=".
  - Unit: Mock de buildUrl → valide la concaténation des scopes.

Story 1.2 — Échange du code OAuth et persistance (handleOAuthCallback)
- AC:
  - L'échange code→tokens fonctionne : access_token + expires_at (et refresh_token si fourni) sont persistés en DB dans table gmail_accounts.
  - Sensibilité : refresh_token n'est pas renvoyé au client dans la réponse.
  - En cas d'échec d'échange, l'endpoint renvoie 500 avec message explicite.
  - Un enregistrement dans gmail_import_runs est créé (statut 'created').
- Tests:
  - Integration: Appeler GET /api/sync/gmail/callback?code=FAKE
    - Given un token endpoint Google simulé qui renvoie access_token + refresh_token + expires_in,
    - When le serveur échange le code,
    - Then la DB contient une ligne gmail_accounts avec google_user_id, email, access_token et expires_at non nul; la réponse renvoie id/email/display_name/expires_at (sans refresh_token).
  - Unit: Mock fetch token endpoint → valider traitement du JSON + upsert SQL.

Story 1.3 — Importer les threads d'un compte lié (job /import)
- AC:
  - La fonction d'import est idempotente (upsert threads, skip messages déjà présents).
  - Pour chaque run, un enregistrement gmail_import_runs est inséré avec détails { imported, attempted }.
  - Les erreurs par thread sont loggées et n'arrêtent pas l'import complet.
  - Respect de limites maxResults (param).
- Tests:
  - Integration: Lancer importThreadsForAccount(accountId, { maxResults: 5 }) avec mock Gmail list + thread GET
    - Given un compte en DB avec access_token valide,
    - When l'import est exécuté,
    - Then threads et messages sont présents en DB; gmail_import_runs contient imported = nombre réellement importés.
  - E2E: Simuler l'ensemble depuis OAuth → importer → vérifier UI /api/threads retourne résultats attendus.

-----------------------------------------------------------------------
EPIC 2 — Inbox / Threads (Triage)

Story 2.1 — Liste de threads paginée (/api/threads)
- AC:
  - GET /api/threads renvoie liste triée par last_message_at desc, supporte pagination (limit/offset ou cursor).
  - Les champs minimum : id, gmail_thread_id, subject, last_message_at.
- Tests:
  - Integration: Insérer threads en DB, appeler GET /api/threads?limit=10
    - Given 15 threads avec dates variées,
    - When j'appelle l'endpoint avec limit=10,
    - Then je reçois 10 résultats triés par last_message_at décroissant.

Story 2.2 — Détail du thread et création d'opportunité depuis thread
- AC:
  - GET /api/threads/:id renvoie messages (subject, body/ snippet, sent_at) et participants (extraction headers: From/To/CC).
  - UI/endpoint propose un bouton/option "Créer opportunité depuis ce thread" qui pré-remplit related_thread_id.
- Tests:
  - Integration: GET /api/threads/:id retourne messages[]. Chaque message contient sent_at non nul.
  - E2E: Depuis liste, ouvrir thread → cliquer "Créer opportunité" → POST /api/opportunities avec related_thread_id pré-rempli = thread.id → réponse 201.

Story 2.3 — Lier/délier un thread à une opportunité
- AC:
  - L'opportunité peut stocker related_thread_id; une API PUT /api/opportunities/:id permet d'ajouter/retirer le lien.
  - Toute liaison génère une entrée ActivityLog avec actor, action_type ('link_thread'/'unlink_thread') et preuve (thread id).
- Tests:
  - Integration: PUT /api/opportunities/:id { related_thread_id: X } → vérifier DB opportunity.related_thread_id = X et ActivityLog row exists.
  - Unit: Validation que related_thread_id correspond à un thread existant sinon 400.

-----------------------------------------------------------------------
EPIC 3 — Opportunités (CRUD & workflow)

Story 3.1 — Créer une opportunité (POST /api/opportunities)
- AC:
  - POST valide payload; title est requis.
  - Retour 201 avec resource persisted.
  - Champs persistés : title, status (default), date (opt), cachet, venue_id, owner_id, created_by, related_thread_id.
- Tests:
  - Integration: POST valid → 201 + DB row; POST missing title → 400.
  - E2E: UI formulaire create → soumettre → redirection vers détail.

Story 3.2 — Mise à jour (PUT /api/opportunities/:id)
- AC:
  - PUT applique modifications permises (title, status, date, cachet, venue_id, owner_id).
  - Changements produisent ActivityLog entries (actor, changed_fields).
- Tests:
  - Integration: PUT change status → verify DB and ActivityLog.

Story 3.3 — Liste et vue détail filtrable
- AC:
  - GET /api/opportunities supporte filtres by status, owner; permet pagination.
  - Detail inclut activity log et thread lié (si any).
- Tests:
  - Integration: seed plusieurs opportunities statuses → GET with filter returns subset.

-----------------------------------------------------------------------
EPIC 4 — Composer (AI-assisted + anti-duplicate)

Story 4.1 — Créer draft et demander suggestion IA (POST /api/compose)
- AC:
  - POST /api/compose accepte opportunity_id, to[], subject, body, request_ai (bool).
  - Si request_ai=true, la réponse est 202 avec draft_id et status 'queued'.
  - Draft stored with metadata status/draft_id.
- Tests:
  - Integration: POST with request_ai=true -> 202 + draft row with status 'queued'.
  - Unit: Validation des champs (to[] non vide si send requested).

Story 4.2 — Générer suggestion IA et stocker méta
- AC:
  - Worker consomme draft queue, appelle LLM, stocke suggestion + metadata (model, prompt, timestamp).
  - Suggestion exposée via GET /api/compose/:draft_id/suggestion.
  - Suggestion doit être idempotente (réexécution ne duplique pas suggestions).
- Tests:
  - Integration/Worker: Queue un draft, mock LLM -> vérifier suggestion row et endpoint GET renvoie suggestion et metadata.

Story 4.3 — Détection anti-duplicate et verrou (Lock)
- AC:
  - Avant envoi réel, système exécute check déduplication via ActivityLog + Threads.
  - Si duplication détectée, API renvoie 409 with lock object { locked_by, reason, evidence } et UI affiche modal.
  - Lock stocké en Redis avec TTL configurable (ex: 10 minutes).
- Tests:
  - Unit: given recent send matching recipient+subject pattern → dedupe returns true + evidence.
  - Integration: POST send draft → mock ActivityLog contenant recent send → API 409 and lock created in Redis.
  - E2E: UI shows modal with evidence and "Force send" button (disabled until user confirms).

Story 4.4 — Forcer l'envoi malgré lock (audit)
- AC:
  - Action "force send" possible; crée ActivityLog entry with action_type 'force_send', reason and actor.
  - System records who forced and why.
- Tests:
  - Integration: POST /api/compose/:draft_id/send?force=true → if lock exists, still send but ActivityLog contains force_send entry.

-----------------------------------------------------------------------
EPIC 5 — Contacts & Venues (Salles)

Story 5.1 — CRUD Contact
- AC:
  - Endpoints CRUD pour contacts; validations email format et phone (basic).
  - Contacts peuvent être liés aux venues (many-to-many).
  - Historique d’édition (who/when) stocké.
- Tests:
  - Integration: POST/GET/PUT/DELETE contact; invalid email -> 400.

Story 5.2 — CRUD Venue (Salle) avec geo
- AC:
  - Endpoints CRUD; venue may contain name, address, geo{lat,lng}, capacity.
  - Search par nom/adresse.
- Tests:
  - Integration: Create venue with geo -> GET returns lat/lng as numbers.

Story 5.3 — Liaison contact ↔ opportunité
- AC:
  - From opportunity detail, search contacts and attach as interlocuteurs; association persisted.
- Tests:
  - E2E: Search contact in opportunity UI -> attach -> DB association present.

-----------------------------------------------------------------------
EPIC 6 — Dashboard & Visualisations

Story 6.1 — KPIs par statut
- AC:
  - Dashboard endpoint fournit counts par statut pour période donnée (query params start/end).
- Tests:
  - Integration: Seed opportunities → GET /api/dashboard?start=...&end=... -> validate counts.

Story 6.2 — Calendrier (opportunités)
- AC:
  - Endpoint fournit opportunités avec date planifiée dans format calendar event.
  - Events cliquables renvoient detail_url.
- Tests:
  - Integration + E2E: Calendar shows events; click open detail.

Story 6.3 — Carte des venues
- AC:
  - Map endpoint fournit venues with geo; UI deep-link vers provider (Google Maps/OSM) ou embed.
- Tests:
  - Integration: GET venues -> lat/lng present and valid.

-----------------------------------------------------------------------
EPIC 7 — Background workers, intégrations & fiabilité

Story 7.1 — Worker Gmail import (robuste)
- AC:
  - Worker idempotent et retryable, backoff exponentiel, metrics emitted (success/fail counts).
  - Supporte job locking (Redis/Bull) pour éviter doublons.
- Tests:
  - Integration: Simulate failing Gmail API -> job retries and emits metrics; eventual succeed persists rows.

Story 7.2 — Worker génération IA
- AC:
  - Rate-limiting respecte quota provider; failures trigger retry with backoff; cache suggestions to prevent duplicate calls.
- Tests:
  - Unit + Integration with mocked LLM: verify rate-limit logic.

Story 7.3 — Worker déduplication
- AC:
  - Periodic job to detect near-duplicates and flag opportunities/threads for review; creates ActivityLog items.
- Tests:
  - Integration: Seed similar messages -> worker flags duplicates.

-----------------------------------------------------------------------
EPIC 8 — Observabilité, sécurité & infra

Story 8.1 — Logging structuré
- AC:
  - Tous services écrivent JSON logs avec fields: timestamp, level, service, trace_id, msg, metadata.
- Tests:
  - Unit: Logger output valid JSON et contient fields requis.

Story 8.2 — Métriques & alertes
- AC:
  - Export Prometheus metrics: queue_depth, import_latency, suggestion_latency, failed_jobs.
  - Alerts: queue_depth > threshold, repeated import failures, auth expirations.
- Tests:
  - Integration: Metrics endpoint exposes metrics; sample alert rules documented.

Story 8.3 — GDPR endpoints (export & delete)
- AC:
  - Endpoint export user data by email/id and endpoint delete user data (soft/hard) that remove PII and create audit trail.
  - Delete requests require authentication and are logged.
- Tests:
  - Integration: Request export -> ZIP/JSON contains expected entities; Request delete -> data removed/ anonymized and ActivityLog entry created.

-----------------------------------------------------------------------
Livrables tests & validation
- Pour chaque story : au minimum 1 integration test automatisé (API) et 1 unit test pour la logique critique.
- Scénarios E2E prioritaires : OAuth flow (happy path), Import → Thread visible in Inbox, Create opportunity from Thread, Compose with AI suggestion, Deduplication flow (409 + force send).
- Ajouter fixtures and mocks pour Google OAuth/Gmail and LLM provider pour tests CI.

Priorisation & notes pratiques
- MVP minimal pour release interne : Stories 1.1, 1.2, 1.3, 2.1, 3.1, 2.2 (création opportunité depuis thread) et worker import. Ces stories doivent avoir tests d'intégration automatisés.
- Documenter chaque décision de sécurité / stockage de tokens dans ADRs (`_bmad/adrs/`) et chiffrer refresh_token en production.

-----------------------------------------------------------------------
Fin du document — Généré par l'équipe produit (format prêt à copier dans tickets).
