---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
workflowType: 'research'
lastStep: 5
research_type: 'technical'
research_topic: 'Intégration Gmail API pour boîte mail partagée : auth, scopes, sync threads, pièces jointes, audit trail'
research_goals: 'Focaliser la recherche sur Gmail API + OAuth (scopes minimaux), watch/push, sync incremental (history/pagination/idempotence), et mapping thread→salle (heuristiques + UX de validation).'
user_name: 'Mathieu'
date: '2026-01-07T17:37:48Z'
web_research_enabled: true
source_verification: true
---

# Research Report: technical

**Date:** 2026-01-07T17:37:48Z
**Author:** Mathieu
**Research Type:** technical

---

## Research Overview

[Research overview and methodology will be appended here]

---

## Technical Research Scope Confirmation

**Research Topic:** Intégration Gmail API pour boîte mail partagée : auth, scopes, sync threads, pièces jointes, audit trail
**Research Goals:** Focaliser la recherche sur Gmail API + OAuth (scopes minimaux), watch/push, sync incremental (history/pagination/idempotence), et mapping thread→salle (heuristiques + UX de validation).

**Technical Research Scope:**
- Gmail API (primitives utiles, objets clés, contraintes/quotas à anticiper)
- OAuth (auth + scopes minimaux, tokens/refresh, implications “boîte partagée”)
- Watch / Push (mécanismes de notification, renouvellement, fiabilité, erreurs/désync)
- Sync incremental (initial + incrémental, history/cursors, pagination, idempotence, backoff)
- Mapping thread → salle (règles/heuristiques + UX de validation, ambiguïtés, qualité données)

**Research Methodology:**
- Web data current + source verification (URLs) pour chaque affirmation factuelle
- Validation multi-sources pour les points critiques
- Indication de niveau de confiance si données incertaines

**Scope Confirmed:** 2026-01-07T17:40:04Z

---

## Technology Stack Analysis

### Programming Languages

**Faits (sources)**
- Google publie des **client libraries** officielles pour plusieurs langages (dont **Node.js** et **Python**) via sa page “API Client Libraries”.
  Source: https://developers.google.com/api-client-library

**Analyse (interprétation)**
- Pour une app interne mobile-first avec backend, les choix “langage” les plus probables viennent du backend et des workers de sync:
  - **Node.js/TypeScript** : bon fit si vous voulez itérer vite et partager des types (DTO) côté API + traitements mail.
  - **Python** : bon fit pour scripts/ETL, prototypes de matching thread→salle, ou workers batch.
- Côté mobile, le “langage” dépend du framework (non couvert ici faute de source spécifique à votre stack mobile).

### Development Frameworks and Libraries

**Faits (sources)**
- Les **endpoints Gmail** à connaître pour le push / l’incrémental :
  - `users.watch` (push notifications vers Pub/Sub, et réponse contenant `historyId` + `expiration`).
    Sources:
    - https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/watch
    - https://developers.google.com/workspace/gmail/api/guides/push
  - `users.history.list` (récupération de l’historique des changements, résultats ordonnés par `historyId`).
    Source: https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.history/list
- Les **scopes OAuth** requis incluent `https://www.googleapis.com/auth/gmail.readonly` et `https://www.googleapis.com/auth/gmail.modify` (listés sur les pages des méthodes).
  Sources:
  - https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/watch
  - https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.history/list

**Analyse (interprétation)**
- Le “framework” critique ici est surtout l’assemblage de composants :
  - une lib OAuth 2.0 côté backend (gestion refresh tokens, rotation, stockage sûr),
  - un client Gmail API (via libs officielles),
  - un consommateur Pub/Sub + un pipeline d’ingestion idempotent.

### Database and Storage Technologies

**Faits (sources)**
- Le guide de synchronisation recommande de **stocker le `historyId`** le plus récent afin de permettre une synchronisation partielle (incrémentale).
  Source: https://developers.google.com/workspace/gmail/api/guides/sync
- `users.history.list` renvoie l’historique en ordre chronologique croissant de `historyId`.
  Source: https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.history/list

**Analyse (interprétation)**
- Pour rendre le système fiable, il faut persister au minimum :
  - `historyId` “checkpoint” par mailbox,
  - les IDs messages/threads déjà vus,
  - l’état de mapping thread→salle (et les confirmations manuelles),
  - un log/audit minimal des actions internes (ex: “thread attaché à salle X par user Y”).
- Un SGBD relationnel (PostgreSQL) convient souvent à ce type de modèle (mappings + audit). Si vous avez déjà une infra, la cohérence avec l’existant prime.

### Development Tools and Platforms

**Faits (sources)**
- Le push Gmail s’appuie sur **Google Cloud Pub/Sub** : la requête `users.watch` contient `topicName`, qui doit être un topic Pub/Sub existant.
  Sources:
  - https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/watch
  - https://developers.google.com/workspace/gmail/api/guides/push
- Pub/Sub est un service “publisher/subscriber” de Google Cloud (vue d’ensemble).
  Source: https://docs.cloud.google.com/pubsub/docs/overview

**Analyse (interprétation)**
- Outils typiques à prévoir autour :
  - un worker/consumer Pub/Sub (Cloud Run / Functions / VM),
  - une file/retry (souvent gérée via Pub/Sub + DLQ),
  - monitoring/alerting (surtout sur “lag” et erreurs auth).

### Cloud Infrastructure and Deployment

**Faits (sources)**
- L’intégration push Gmail utilise Pub/Sub (GCP).
  Sources:
  - https://developers.google.com/workspace/gmail/api/guides/push
  - https://docs.cloud.google.com/pubsub/docs/overview

**Analyse (interprétation)**
- Si vous partez sur GCP, l’architecture la plus simple est : Gmail `watch` → Pub/Sub → worker (Cloud Run) → DB.
- Si vous êtes sur un autre cloud, vous pouvez quand même consommer Pub/Sub (GCP) depuis l’extérieur, mais ça ajoute de la surface ops (réseau, IAM, latence, monitoring).

### Technology Adoption Trends

**Faits (sources)**
- Le guide push indique que, dans certains scénarios (ex: apps mail clients), l’approche **poll-based** via le **sync guide** reste recommandée pour récupérer les updates (donc: push ≠ suppression totale de la logique de sync).
  Source: https://developers.google.com/workspace/gmail/api/guides/push

**Analyse (interprétation)**
- Pattern “robuste” : push pour déclencher rapidement, sync incrémental (`historyId` + `users.history.list`) comme vérité terrain.
- Mapping thread→salle : tendance produit = “auto-suggestion + validation humaine”, car le matching parfait 100% automatique est difficile dès le départ.

**Confidence**
- Faits cités : [High Confidence] (sources officielles Google).
- Choix d’implémentation (DB/framework/cloud) : [Medium Confidence] (dépend de votre stack et contraintes).

---

## Integration Patterns Analysis

### API Design Patterns

**Faits (sources)**
- L’intégration Gmail repose sur une API **REST** structurée autour de ressources et méthodes, notamment :
  - `users.messages.list` (listing) : https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list
  - `users.messages.get` (détails) : https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get
  - `users.threads.get` (thread) : https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.threads/get
  - `users.history.list` (changements) : https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.history/list
- Le guide “Push Notifications” décrit l’approche push mais renvoie aussi au guide de sync pour récupérer les updates de façon fiable.
  Source: https://developers.google.com/workspace/gmail/api/guides/push

**Analyse (interprétation)**
- Pattern recommandé “production-grade” pour votre cas :
  1) **Trigger** via push (`users.watch` → Pub/Sub),
  2) **Rattrapage/consistance** via sync incrémental (`historyId` + `users.history.list`),
  3) **Hydratation** (si besoin) via `messages.get` / `threads.get`.
- Pattern “liste puis get” : on liste des IDs (messages/threads) puis on hydrate à la demande pour réduire le coût réseau/temps.

### Communication Protocols

**Faits (sources)**
- Les notifications push Gmail s’appuient sur **Google Cloud Pub/Sub** (le `topicName` est fourni dans la requête `users.watch`).
  Sources:
  - https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/watch
  - https://developers.google.com/workspace/gmail/api/guides/push
- Pub/Sub supporte des modèles **publish/subscribe**.
  Source: https://docs.cloud.google.com/pubsub/docs/overview
- Pub/Sub supporte les **push subscriptions** (livraison vers une URL HTTP(S)).
  Source: https://docs.cloud.google.com/pubsub/docs/push

**Analyse (interprétation)**
- Pour une app interne mobile, le backend “mail ingest” reçoit :
  - soit des messages Pub/Sub en **push** vers un endpoint HTTP (Cloud Run typiquement),
  - soit en **pull** (worker qui consomme la subscription).
- En pratique, push = rapide mais impose de gérer correctement la sécurité HTTP et les retries; pull = plus simple à sécuriser mais nécessite un worker/cron/polling.

### Data Formats and Standards

**Faits (sources)**
- Les références REST Gmail montrent des requêtes/réponses structurées en JSON (ex: exemples autour de `users.watch` avec `historyId` et `expiration`).
  Sources:
  - https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/watch
  - https://developers.google.com/workspace/gmail/api/guides/push

**Analyse (interprétation)**
- Pour le mapping thread→salle, il faut définir un format interne stable (DTO) qui encapsule :
  - IDs Gmail (messageId/threadId),
  - métadonnées utiles (timestamps, labelIds, etc.),
  - références “domaine” (salleId, concertId),
  - statut “match” (auto-suggéré vs confirmé).

### System Interoperability Approaches

**Faits (sources)**
- Le guide de sync met en avant l’usage du `historyId` pour une synchronisation partielle (incrémentale).
  Source: https://developers.google.com/workspace/gmail/api/guides/sync
- `users.history.list` renvoie l’historique des changements en ordre chronologique (increasing `historyId`).
  Source: https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.history/list

**Analyse (interprétation)**
- Interop “robuste” = event-driven + checkpointing :
  - Pub/Sub donne un signal “quelque chose a changé”,
  - le **checkpoint** (historyId) protège contre pertes/duplications d’événements et permet le rattrapage.
- Pour éviter les doublons/relances incohérentes côté produit, ce même pattern (event + checkpoint + idempotence) est réutilisable sur vos événements métier (assignations, relances, changements pipeline).

### Microservices Integration Patterns

**Faits (sources)**
- Pub/Sub fournit le mécanisme de découplage entre producteurs/consommateurs via topics/subscriptions.
  Source: https://docs.cloud.google.com/pubsub/docs/overview

**Analyse (interprétation)**
- Même si vous ne faites pas “microservices”, vous aurez plusieurs composants logiques :
  - **Ingestion** (Pub/Sub consumer),
  - **Sync** (history catch-up),
  - **Enrichissement** (hydrate message/thread),
  - **Matching** (thread→salle),
  - **API produit** (mobile).
- Points d’intégration clés :
  - **Idempotence** (ne pas retraiter 2 fois le même historyId/événement),
  - **Retry + DLQ** (pour erreurs transitoires auth/quota/réseau),
  - **Observabilité** (lag de subscription, taux d’erreurs, âge du checkpoint).

### Event-Driven Integration

**Faits (sources)**
- `users.watch` publie vers un topic Pub/Sub (`topicName`) et renvoie notamment `historyId`.
  Source: https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/watch
- Le guide push indique l’usage de Pub/Sub et renvoie au guide de sync comme approche recommandée pour récupérer les updates.
  Source: https://developers.google.com/workspace/gmail/api/guides/push

**Analyse (interprétation)**
- Pattern concret :
  - Event (Pub/Sub) → “wake up”
  - Sync (`users.history.list` à partir du checkpoint) → “truth”
  - Hydrate (messages/threads get) → “context”
  - Matching/UX → “resolution”
- Cette séquence permet aussi de tenir la promesse “notif → contexte en <10s” (si le matching est suffisamment bon et que l’app propose une validation rapide).

### Integration Security Patterns

**Faits (sources)**
- OAuth 2.0 : une fois un access token obtenu, il est envoyé à l’API via le header HTTP `Authorization`.
  Source: https://developers.google.com/identity/protocols/oauth2
- Les méthodes Gmail listent des scopes requis (ex: `https://www.googleapis.com/auth/gmail.readonly`, `https://www.googleapis.com/auth/gmail.modify`).
  Sources:
  - https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/watch
  - https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.history/list
- Pub/Sub push subscriptions ont des considérations d’authentification (doc dédiée).
  Source: https://docs.cloud.google.com/pubsub/docs/push

**Analyse (interprétation)**
- Minimiser les scopes (readonly vs modify) réduit le risque, mais attention : certaines fonctionnalités (labels / marquage / actions) peuvent nécessiter `gmail.modify`.
- Le “shared mailbox” (boîte partagée) dépend de votre modèle d’auth :
  - soit un compte “service” (mais Gmail API est user-centric),
  - soit une auth par utilisateur + accès délégué/partagé côté Google Workspace (à cadrer plus tard).

**Confidence**
- Faits cités : [High Confidence] (sources officielles).
- Recommandations d’architecture : [Medium Confidence] (dépend du contexte d’hébergement, volume mails, contraintes de l’équipe).

---

## Architectural Patterns and Design

### System Architecture Patterns

**Faits (sources)**
- Les styles d’architecture (ex: N-tier, microservices) sont présentés comme des “familles” d’architectures partageant des caractéristiques.
  Source: https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/
- Des patterns cloud (dont **Saga**, **CQRS**) existent pour gérer la consistance et la complexité en systèmes distribués.
  Source: https://learn.microsoft.com/en-us/azure/architecture/patterns/
- Pub/Sub est positionné comme un “enterprise event bus” et un support pour le design **event-driven**.
  Source: https://docs.cloud.google.com/pubsub/docs/overview
- Cloud Run vise des cas d’usage “APIs and microservices” et du serverless managé pour exécuter des services.
  Source: https://docs.cloud.google.com/run/docs/overview/what-is-cloud-run

**Analyse (interprétation)**
- Pour votre besoin “Gmail watch/push + sync incremental + mapping thread→salle”, une architecture **event-driven** simple est le meilleur compromis :
  - Gmail `users.watch` → Pub/Sub → **Ingestion service** (Cloud Run) → **Sync service** (history catch-up) → DB → API mobile.
- “Microservices” vs “monolithe” :
  - Démarrer en **monolithe modulaire** (un service unique avec modules) est souvent plus rapide, tout en gardant des frontières internes (ingestion/sync/matching).
  - Découper en services séparés devient pertinent si : volume d’événements élevé, besoins d’isolation (auth/quota), ou évolutions de matching.
- Important : même en event-driven, vous devez conserver un **checkpoint** (historyId) et de l’**idempotence** (cf. sections précédentes) : le push est un trigger, pas une source de vérité exhaustive.

_Source: https://docs.cloud.google.com/pubsub/docs/overview_

### Design Principles and Best Practices

**Faits (sources)**
- Le Twelve-Factor App décrit des principes d’app cloud modernes (portabilité, séparation config/code, logs comme flux d’événements, etc.).
  Source: https://12factor.net/
- Les frameworks “well-architected” (AWS, Google Cloud) synthétisent des bonnes pratiques de design/opérations (fiabilité, sécurité, performance, cost).
  Sources:
  - https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html
  - https://docs.cloud.google.com/architecture/framework

**Analyse (interprétation)**
- Principes à appliquer au “mail ingest” :
  - **Logs as event streams** (12-factor) + corrélation (messageId/threadId/historyId) pour diagnostiquer.
  - **Configuration externe** (12-factor) : scopes, topicName, fenêtres “recent”, seuils de retry/backoff.
  - **Separation of concerns** : ingestion (events) ≠ sync (history) ≠ matching (heuristiques) ≠ API produit.

_Source: https://12factor.net/_

### Scalability and Performance Patterns

**Faits (sources)**
- Les frameworks well-architected adressent performance/efficacité et les trade-offs d’architecture cloud.
  Sources:
  - https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html
  - https://docs.cloud.google.com/architecture/framework

**Analyse (interprétation)**
- Scalabilité :
  - Dimensionner d’abord le consumer Pub/Sub (concurrency) et le stockage (DB) ; le reste suit.
  - Prévoir un **bulk catch-up** (initial sync) distinct du **realtime catch-up** (history increments).
- Performance perçue (mobile “<10s”) :
  - Mettre en cache les “conversations importantes” (threads actifs) et pré-calculer des suggestions (thread→salle).
  - Limiter l’hydratation (messages.get/threads.get) à ce qui est nécessaire (métadonnées vs full body).

_Source: https://docs.cloud.google.com/architecture/framework_

### Integration and Communication Patterns

**Faits (sources)**
- Pub/Sub supporte des patterns event-driven et peut servir d’event bus.
  Source: https://docs.cloud.google.com/pubsub/docs/overview
- Les patterns Azure couvrent des scénarios distribués (ex: Saga / CQRS / compensating actions).
  Sources:
  - https://learn.microsoft.com/en-us/azure/architecture/patterns/
  - https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs
  - https://learn.microsoft.com/en-us/azure/architecture/patterns/compensating-transaction

**Analyse (interprétation)**
- Même si vous ne faites pas de “transactions distribuées”, l’idée de **compensation** est utile :
  - si un mapping auto est faux, vous devez pouvoir “annuler” (détacher/reclasser) et recalculer.
- Pour “anti-doublon” (produit), un modèle CQRS léger peut aider :
  - write-model (actions) → events → read-model (vue mobile optimisée) mis à jour async.

_Source: https://learn.microsoft.com/en-us/azure/architecture/patterns/_

### Security Architecture Patterns

**Faits (sources)**
- Les frameworks well-architected couvrent explicitement la sécurité (contrôles, identité, gouvernance).
  Sources:
  - https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html
  - https://docs.cloud.google.com/architecture/framework
- Pub/Sub et Cloud Run impliquent IAM, endpoints, et surfaces d’attaque associées.
  Sources:
  - https://docs.cloud.google.com/pubsub/docs/overview
  - https://docs.cloud.google.com/run/docs/overview/what-is-cloud-run

**Analyse (interprétation)**
- Sécurité “minimum viable” :
  - Stockage chiffré des tokens (au repos) + rotation/invalidations.
  - Principe du moindre privilège : scopes OAuth minimaux + IAM Pub/Sub minimal (publisher/subscriber).
  - Audit trail : loguer qui a “attaché” / “déplacé” / “relancé”.

_Source: https://docs.cloud.google.com/architecture/framework_

### Data Architecture Patterns

**Faits (sources)**
- Les frameworks well-architected traitent aussi de la gouvernance des données et de la fiabilité des systèmes (incluant des choix data).
  Sources:
  - https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html
  - https://docs.cloud.google.com/architecture/framework

**Analyse (interprétation)**
- Modèle data recommandé (minimum) :
  - Table `gmail_mailbox_checkpoint` (mailboxId, historyId, updatedAt)
  - Tables `gmail_thread`, `gmail_message` (ids + métadonnées utiles)
  - Table `thread_venue_mapping` (threadId ↔ venueId, confidence, confirmedBy, confirmedAt)
  - Table `audit_log` (action, actor, target, timestamp)
- Stratégie de consistance :
  - idempotence “par historyId” + “par messageId/threadId”
  - déduplication au niveau DB (unique constraints)

_Source: https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html_

### Deployment and Operations Architecture

**Faits (sources)**
- Twelve-Factor traite explicitement la portabilité et les pratiques ops (dont logs, dev/prod parity, etc.).
  Source: https://12factor.net/
- Les frameworks well-architected sont conçus pour guider le design ET l’opération de systèmes cloud.
  Sources:
  - https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html
  - https://docs.cloud.google.com/architecture/framework

**Analyse (interprétation)**
- Ops à prévoir dès v0 :
  - métriques : taux d’événements, lag subscription, erreurs auth/quota, “âge du checkpoint historyId”
  - alerting : backlog Pub/Sub, échecs répétés de sync, tokens expirés
  - runbooks : “rebuild from scratch” (full sync) et “replay from checkpoint”

_Source: https://12factor.net/_

**Confidence**
- Faits cités : [High Confidence] (sources reconnues).
- Recommandations concrètes (tables/compartiments) : [Medium Confidence] (dépend du stack retenu et des volumes).

---

## Implementation Approaches and Technology Adoption

### Technology Adoption Strategies

**Faits (sources)**
- Le Twelve-Factor insiste sur des pratiques qui favorisent l’agilité, dont la réduction de divergence dev/prod et le support du continuous deployment.
  Source: https://12factor.net/
- Les frameworks Well-Architected (AWS / Google) cadrent les décisions d’architecture et d’exploitation autour de piliers (fiabilité, sécurité, efficacité/performance, coûts, excellence opérationnelle).
  Sources:
  - https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html
  - https://docs.cloud.google.com/architecture/framework

**Approche recommandée (interprétation)**
- Stratégie d’adoption “progressive” (safe) pour votre cas :
  1) **Read-only d’abord** : ingestion + sync + affichage contexte (réduit le risque).
  2) Ajout des actions “write” (labels / modifications éventuelles) uniquement si besoin, et après validation sécurité/scopes.
  3) Expansion graduelle : meilleure auto-suggestion mapping thread→salle, puis UX anti-doublon, puis éventuellement offline (si nécessaire).
- Garder un mode “rebuild” (full sync) et un mode “replay from checkpoint” pour diagnostiquer/relancer.

_Source: https://docs.cloud.google.com/architecture/framework_

### Development Workflows and Tooling

**Faits (sources)**
- Twelve-Factor recommande config externe et logs comme flux d’événements, ce qui se marie bien avec CI/CD et environnements reproductibles.
  Source: https://12factor.net/
- Cloud Run documente le déploiement d’images container (modèle compatible avec CI/CD).
  Source: https://docs.cloud.google.com/run/docs/deploying

**Approche recommandée (interprétation)**
- Workflow minimal :
  - PR + review obligatoire sur la partie auth/sync (risque élevé).
  - Environnements : dev/staging/prod proches (12-factor “dev/prod parity”).
  - Déploiement : container Cloud Run (ou équivalent) + variables de config (topicName, timeouts, scopes, etc.)
- Outillage clé :
  - tests de non-régression sur parsing + mapping thread→salle,
  - scripts de “replay” (rebuild from scratch / replay historyId).

_Source: https://docs.cloud.google.com/run/docs/deploying_

### Testing and Quality Assurance

**Faits (sources)**
- Le Twelve-Factor pousse à des systèmes déployables et observables (logs), ce qui supporte la QA et le debugging.
  Source: https://12factor.net/
- Cloud Trace / Monitoring / Logging sont des composants standards d’observabilité (docs produits).
  Sources:
  - https://docs.cloud.google.com/logging/docs
  - https://docs.cloud.google.com/monitoring/docs
  - https://docs.cloud.google.com/trace/docs

**Approche recommandée (interprétation)**
- Tests incontournables :
  - Idempotence : rejouer le même événement / même `historyId` sans effets de bord.
  - Robustesse : quotas/rate limits, timeouts, retries (y compris messages en double / en retard).
  - Matching : tests sur jeux de données (threads ambigus, sujets non-pertinents).
- QA “fonctionnelle” :
  - “notif → contexte en <10s” mesuré end-to-end sur un scénario réaliste.

_Source: https://docs.cloud.google.com/monitoring/docs_

### Deployment and Operations Practices

**Faits (sources)**
- Well-Architected (AWS/GCP) couvre les pratiques ops (fiabilité, sécurité, excellence opérationnelle).
  Sources:
  - https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html
  - https://docs.cloud.google.com/architecture/framework
- Pub/Sub est un composant event-driven majeur (docs overview).
  Source: https://docs.cloud.google.com/pubsub/docs/overview

**Approche recommandée (interprétation)**
- Ops à mettre en place dès v0 :
  - métriques : backlog/lag subscription, erreurs auth, échecs `history.list`, âge du checkpoint,
  - dashboards : ingestion rate, processing latency, “time-to-context”,
  - alertes : backlog qui croît, erreurs répétées, tokens invalides.
- Runbooks :
  - “rebuild from scratch”,
  - “replay from checkpoint”,
  - “rotate OAuth credentials / revoke tokens”.

_Source: https://docs.cloud.google.com/pubsub/docs/overview_

### Team Organization and Skills

**Faits (sources)**
- OAuth2 comporte des implications de sécurité; la doc recommande fortement d’utiliser des bibliothèques OAuth2, compte tenu des risques liés à une implémentation incorrecte.
  Source: https://developers.google.com/identity/protocols/oauth2

**Approche recommandée (interprétation)**
- Compétences minimales à sécuriser :
  - OAuth2 (tokens/refresh, stockage sécurisé),
  - event-driven + idempotence,
  - ops/observability (logging/metrics/tracing),
  - data modeling (mapping + audit trail).
- Rôles (même dans une petite équipe) :
  - un “owner sync” (responsable fiabilité),
  - un “owner product workflows” (anti-doublon, assignation, UX mobile).

_Source: https://developers.google.com/identity/protocols/oauth2_

### Cost Optimization and Resource Management

**Faits (sources)**
- Cloud Run pricing est documenté par Google Cloud.
  Source: https://cloud.google.com/run/pricing
- Twelve-Factor mentionne explicitement la réduction de temps et de coût onboarding via formats déclaratifs et automation.
  Source: https://12factor.net/

**Approche recommandée (interprétation)**
- Le principal driver coût (au début) est souvent :
  - le volume d’événements (Pub/Sub) + le traitement (compute) + la DB.
- Optimisations pragmatiques :
  - limiter l’hydratation “full content” (messages.get) si le produit ne l’exige pas,
  - batcher et dédupliquer,
  - caper la fréquence des relances sync si le push déclenche trop souvent.

_Source: https://cloud.google.com/run/pricing_

### Risk Assessment and Mitigation

**Risques clés (interprétation)**
- Auth/OAuth : mauvaise gestion tokens/scopes → incidents sécurité / instabilité.
- Push : événements manqués/doublonnés → nécessité de checkpoint + rattrapage.
- Matching : faux positifs → UX de correction + audit trail.
- Ops : absence de visibilité → dégradation silencieuse (backlog, stale data).

**Mitigations (avec sources)**
- Utiliser des libs OAuth2 recommandées par Google.
  Source: https://developers.google.com/identity/protocols/oauth2
- S’aligner sur un cadre Well-Architected (GCP/AWS) et 12-factor pour la prod.
  Sources:
  - https://docs.cloud.google.com/architecture/framework
  - https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html
  - https://12factor.net/

---

## Technical Research Recommendations

### Implementation Roadmap

1) **Semaine 0–1 : Foundations**
- OAuth2 (flows + storage tokens + rotation)
- Pub/Sub wiring + consumer
- DB + checkpoint `historyId` + idempotence

2) **Semaine 1–2 : Realtime loop**
- `users.watch` → Pub/Sub → trigger → `users.history.list` catch-up → hydrate minimal
- UI mobile : “inbox triage” + “attacher à…” (validation rapide)

3) **Semaine 2–3 : Mapping quality**
- heuristiques + suggestions + métriques “match accuracy”
- workflow correction + audit trail

4) **Semaine 3+ : Hardening & product workflows**
- anti-doublon relance, ownership/locks,
- dashboards/alerting/runbooks,
- optimisation coûts/latence

### Technology Stack Recommendations

- Démarrer simple : **backend unique modulaire** + **worker Pub/Sub** + **DB relationnelle**.
- Si vous partez GCP : Cloud Run + Pub/Sub + Cloud Logging/Monitoring/Trace (stack cohérente).
  Sources:
  - https://docs.cloud.google.com/run/docs/overview/what-is-cloud-run
  - https://docs.cloud.google.com/pubsub/docs/overview
  - https://docs.cloud.google.com/logging/docs
  - https://docs.cloud.google.com/monitoring/docs
  - https://docs.cloud.google.com/trace/docs

### Skill Development Requirements

- OAuth2 et sécurité (focus “use libraries”).
  Source: https://developers.google.com/identity/protocols/oauth2
- Event-driven + idempotence + retry/backoff
- Observability (logs/metrics/traces)
  Sources:
  - https://docs.cloud.google.com/logging/docs
  - https://docs.cloud.google.com/monitoring/docs
  - https://docs.cloud.google.com/trace/docs

### Success Metrics and KPIs

- **TTC (time-to-context)** : temps entre réception notif → affichage contexte (objectif: <10s)
- **Lag Pub/Sub** : backlog / âge du plus vieux message
- **Freshness** : âge du checkpoint `historyId` (staleness)
- **Match accuracy** : % auto-suggéré confirmé / taux de corrections
- **Ops** : taux d’erreurs sync, retries, incidents auth
- **Coût** : coût compute+DB par jour / par 1000 événements

---

<!-- Content will be appended sequentially through research workflow steps -->