# Tickets — Gigator (Markdown export)

Référence : critères détaillés et scénarios de test -> [`docs/acceptance_criteria_and_tests.md`](docs/acceptance_criteria_and_tests.md:1)  
Architecture & API : [`ARCHITECTURE.md`](ARCHITECTURE.md:1), [`app/backend/openapi.yaml`](app/backend/openapi.yaml:1)

Format ticket (par entrée)
- Titre
- Epic
- Description (court)
- Critères d'acceptation (AC)
- Scénarios de test (Given / When / Then)
- Priorité / Estimation (T-shirt)

-----------------------------------------------------------------------
TICKET GIG-001
Titre: Démarrer le flux OAuth (POST /api/sync/gmail/start)
Epic: Auth & Gmail sync
Description: Endpoint qui construit et renvoie l'URL de consentement Google (state inclus).
AC:
- POST /api/sync/gmail/start renvoie 200 { oauth_url: string }.
- oauth_url contient client_id, redirect_uri, scope, response_type et state.
Scénario:
- Given que les variables d'environnement OAuth sont présentes,
- When j'appelle POST /api/sync/gmail/start,
- Then la réponse contient oauth_url commençant par "https://accounts.google.com/o/oauth2/v2/auth?" et contenant "state=".
Priorité: P0 / Estimation: S

TICKET GIG-002
Titre: Échange code OAuth et persistance (GET /api/sync/gmail/callback)
Epic: Auth & Gmail sync
Description: Échanger le code contre tokens, upsert dans `gmail_accounts` et créer run d'import.
AC:
- access_token et expires_at persistés; refresh_token persisté si fourni.
- Response sanitized (pas de refresh_token renvoyé).
- gmail_import_runs enregistre une entrée 'created'.
Scénario:
- Given un token endpoint Google mocké qui renvoie tokens,
- When le serveur échange le code,
- Then la DB contient gmail_accounts et la réponse renvoie id/email/display_name/expires_at.
Priorité: P0 / Estimation: M

TICKET GIG-003
Titre: Importer threads d'un compte lié (job importThreadsForAccount)
Epic: Auth & Gmail sync
Description: Job idempotent qui récupère la liste des threads et upsert threads/messages.
AC:
- Upsert threads; skip messages existants; run enregistré avec imported/attempted.
- Erreurs par thread logguées sans stopper l'import.
Scénario:
- Given un compte avec access_token valide,
- When importThreadsForAccount(accountId, { maxResults: N }) est exécuté,
- Then threads/messages sont persistés et gmail_import_runs contient imported.
Priorité: P0 / Estimation: M

-----------------------------------------------------------------------
TICKET GIG-004
Titre: Liste paginée de threads (GET /api/threads)
Epic: Inbox / Threads
Description: Endpoint renvoyant threads triés par last_message_at avec pagination.
AC:
- Supporte limit/offset (ou cursor); champs min: id, gmail_thread_id, subject, last_message_at.
Scénario:
- Given 15 threads en DB,
- When GET /api/threads?limit=10,
- Then la réponse contient 10 threads triés par last_message_at desc.
Priorité: P0 / Estimation: S

TICKET GIG-005
Titre: Détail du thread et création opportunité depuis thread
Epic: Inbox / Threads
Description: Afficher messages/participants et bouton "Créer opportunité" pré-rempli.
AC:
- GET /api/threads/:id renvoie messages (subject, body/snippet, sent_at) et participants (From/To/CC).
- UI permet de créer une opportunité pré-remplie avec related_thread_id.
Scénario:
- Given un thread avec messages,
- When GET /api/threads/:id,
- Then messages[].sent_at non nul et participants extraits.
Priorité: P0 / Estimation: M

TICKET GIG-006
Titre: Lier / Délier thread ↔ opportunité
Epic: Inbox / Threads
Description: PUT /api/opportunities/:id pour attacher/détacher related_thread_id et journaliser.
AC:
- PUT met à jour related_thread_id; crée ActivityLog (link_thread / unlink_thread).
Scénario:
- Given une opportunité existante,
- When PUT /api/opportunities/:id { related_thread_id: X },
- Then opportunity.related_thread_id = X et ActivityLog contient l'action.
Priorité: P1 / Estimation: S

-----------------------------------------------------------------------
TICKET GIG-007
Titre: Créer opportunité (POST /api/opportunities)
Epic: Opportunités
Description: Endpoint de création d'opportunité (title requis).
AC:
- POST valide title obligatoire; renvoie 201 et resource persistée.
Scénario:
- Given payload valide avec title,
- When POST /api/opportunities,
- Then 201 et row créée en DB.
Priorité: P0 / Estimation: S

TICKET GIG-008
Titre: Mettre à jour opportunité (PUT /api/opportunities/:id)
Epic: Opportunités
Description: Modifier title, status, date, cachet, owner; journaliser changements.
AC:
- Changements persistés et ActivityLog enregistré pour chaque modification importante.
Scénario:
- Given une opportunité existante,
- When PUT /api/opportunities/:id { status: 'Planned' },
- Then DB mis à jour et ActivityLog enregistre le changement.
Priorité: P1 / Estimation: S

TICKET GIG-009
Titre: Liste et détail filtrable d'opportunités
Epic: Opportunités
Description: GET /api/opportunities avec filtres par status et owner; détail inclut activité et thread.
AC:
- Filtres fonctionnels; pagination; détail inclut activity log et related_thread.
Scénario:
- Given plusieurs opportunités seedées,
- When GET /api/opportunities?status=À_relancer,
- Then seuls les résultats correspondant sont retournés.
Priorité: P1 / Estimation: M

-----------------------------------------------------------------------
TICKET GIG-010
Titre: Créer draft et demander suggestion IA (POST /api/compose)
Epic: Composer
Description: Stocker draft et, si demandé, mettre en file pour génération IA (202 queued).
AC:
- POST valide; si request_ai=true renvoie 202 avec draft_id et status queued; draft persisté.
Scénario:
- Given payload avec request_ai=true,
- When POST /api/compose,
- Then 202 et draft row with status 'queued'.
Priorité: P0 / Estimation: M

TICKET GIG-011
Titre: Générer suggestion IA et stocker méta
Epic: Composer
Description: Worker consomme la file, appelle LLM et stocke suggestion + metadata (model, prompt).
AC:
- Suggestion persistée; endpoint GET /api/compose/:draft_id/suggestion renvoie suggestion + metadata.
Scénario:
- Given un draft en queue et LLM mocké,
- When worker consomme le draft,
- Then suggestion row créée et GET /api/compose/:draft_id/suggestion renvoie la suggestion.
Priorité: P1 / Estimation: M

TICKET GIG-012
Titre: Détection anti-duplicate et verrou (Lock)
Epic: Composer
Description: Avant envoi, vérifier ActivityLog + Threads; si duplicate, renvoyer 409 avec lock object; stocker lock en Redis TTL.
AC:
- Détection renvoie preuve; API renvoie 409 + lock { locked_by, reason, evidence }.
Scénario:
- Given un envoi récent similaire en ActivityLog,
- When tenter d'envoyer draft,
- Then API 409 et lock présent en Redis.
Priorité: P0 / Estimation: M

TICKET GIG-013
Titre: Forcer l'envoi malgré lock (audit)
Epic: Composer
Description: Autoriser envoi forcé avec param ?force=true; journaliser action 'force_send' avec raison et acteur.
AC:
- L'envoi est autorisé si force=true; ActivityLog enregistre force_send.
Scénario:
- Given un lock existant,
- When POST /api/compose/:draft_id/send?force=true,
- Then email envoyé et ActivityLog contient force_send entry.
Priorité: P1 / Estimation: S

-----------------------------------------------------------------------
TICKET GIG-014
Titre: CRUD Contact (name, email, phone)
Epic: Contacts & Venues
Description: Endpoints CRUD pour contacts, validation email/phone, liaison venues.
AC:
- Endpoints CRUD fonctionnels; validations; liaison many-to-many to venues.
Scénario:
- Given payload contact valide,
- When POST /api/contacts,
- Then 201 et contact est créé; invalid email -> 400.
Priorité: P1 / Estimation: S

TICKET GIG-015
Titre: CRUD Venue (Salle) avec geo
Epic: Contacts & Venues
Description: Endpoints pour venues (name, address, geo{lat,lng}, capacity) et recherche.
AC:
- CRUD OK; search par nom/adresse fonctionne; lat/lng renvoyés comme nombres.
Scénario:
- Given payload venue avec geo,
- When POST /api/venues,
- Then venue persisted avec geo numbers.
Priorité: P1 / Estimation: S

TICKET GIG-016
Titre: Liaison contact ↔ opportunité (attach interlocuteur)
Epic: Contacts & Venues
Description: Depuis detail opportunité, rechercher et attacher contact en tant qu'interlocuteur.
AC:
- Association persistée; UI permet recherche rapide.
Scénario:
- Given contact existant,
- When POST /api/opportunities/:id/contacts { contact_id: X },
- Then association created.
Priorité: P2 / Estimation: S

-----------------------------------------------------------------------
TICKET GIG-017
Titre: Dashboard — KPIs par statut
Epic: Dashboard & Visualisations
Description: Endpoint qui retourne counts par statut sur période donnée.
AC:
- GET /api/dashboard?start=&end= renvoie counts par statut.
Scénario:
- Given seed d'opportunités,
- When GET /api/dashboard?start=...&end=...,
- Then counts corrects par statut.
Priorité: P2 / Estimation: S

TICKET GIG-018
Titre: Calendrier des opportunités
Epic: Dashboard & Visualisations
Description: Fournir événements calendar à partir des opportunités datées; events cliquables.
AC:
- Endpoint renvoie events avec detail_url; UI clique ouvre détail.
Scénario:
- Given opportunités datées,
- When GET /api/calendar?start=...&end=...,
- Then events list contains ces opportunités.
Priorité: P2 / Estimation: M

TICKET GIG-019
Titre: Carte des venues (map)
Epic: Dashboard & Visualisations
Description: Fournir venues avec geo; UI deep-link/embed map provider.
AC:
- GET /api/venues renvoie lat/lng; UI propose lien vers GoogleMaps/OSM.
Scénario:
- Given venues with geo,
- When GET /api/venues,
- Then lat/lng sont présents et valides.
Priorité: P2 / Estimation: S

-----------------------------------------------------------------------
TICKET GIG-020
Titre: Worker Gmail import robuste (retries, backoff, locking)
Epic: Background workers & Integrations
Description: Worker idempotent, retryable with exponential backoff, emits metrics and uses job locks.
AC:
- Retries en cas d'échec; metrics émis; job locking prévient doublons.
Scénario:
- Given Gmail API intermittent failing,
- When job run,
- Then job retries et finit par succès ou enregistre échec avec métriques.
Priorité: P0 / Estimation: L

TICKET GIG-021
Titre: Worker génération IA (rate-limits & cache)
Epic: Background workers & Integrations
Description: Worker qui consomme drafts, respecte quotas LLM et cache suggestions pour éviter doublons.
AC:
- Rate-limit respecté; cache empêche double call; retries avec backoff.
Scénario:
- Given quota restreint et drafts en queue,
- When worker exécute,
- Then rate-limit respected and suggestions cached.
Priorité: P1 / Estimation: M

TICKET GIG-022
Titre: Worker de déduplication périodique
Epic: Background workers & Integrations
Description: Job périodique détecte near-duplicates et crée ActivityLog pour revue.
AC:
- Duplicate flags créés et reachable via admin UI/endpoint.
Scénario:
- Given similar messages/opps,
- When dedupe worker runs,
- Then flagged items and activities created.
Priorité: P2 / Estimation: M

-----------------------------------------------------------------------
TICKET GIG-023
Titre: Logging structuré JSON
Epic: Observabilité, sécurité & infra
Description: Standardiser logs JSON (timestamp, level, service, trace_id, msg, metadata).
AC:
- Tous services utilisent logger JSON; fields requis présents.
Scénario:
- Unit test logger -> output JSON with required fields.
Priorité: P1 / Estimation: S

TICKET GIG-024
Titre: Métriques Prometheus & règles d'alerte
Epic: Observabilité, sécurité & infra
Description: Exporter métriques clés (queue_depth, import_latency, suggestion_latency, failed_jobs) et documenter alert rules.
AC:
- Metrics endpoint exposé; alert rules (queue backlog, repeated failures, auth expirations) documentées.
Scénario:
- Given jobs and metrics exposed,
- When metrics scraped,
- Then expected metrics présents.
Priorité: P1 / Estimation: M

TICKET GIG-025
Titre: Endpoints GDPR (export & delete)
Epic: Observabilité, sécurité & infra
Description: Exporter et supprimer/anonymiser les données utilisateur avec audit trail.
AC:
- Export endpoint fournit bundle JSON/ZIP; delete endpoint soft/hard supprime ou anonymise PII et journalise action.
Scénario:
- Given user request export,
- When POST /api/user/export?email=me@ex,
- Then ZIP/JSON returned containing user entities; delete -> data anonymized and ActivityLog entry created.
Priorité: P0 / Estimation: M

-----------------------------------------------------------------------
Usage
- Ce fichier (`docs/tickets.md`) est prêt à être importé ou copié dans JIRA en créant un ticket par section.
- Pour détails tests & AC complets, consulter [`docs/acceptance_criteria_and_tests.md`](docs/acceptance_criteria_and_tests.md:1).

Fin du fichier.