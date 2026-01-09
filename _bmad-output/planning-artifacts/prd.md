---
stepsCompleted: [1, 2, 3, 4, 6, 7, 8, 9, 10, 11]
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-gigator-2026-01-07.md
  - _bmad-output/planning-artifacts/research/technical-integration-gmail-api-boite-mail-partagee-auth-scopes-sync-threads-pieces-jointes-audit-trail-research-2026-01-07.md
  - _bmad-output/analysis/brainstorming-session-2026-01-07T16-48-25Z.md
workflowType: 'prd'
lastStep: 11
briefCount: 1
researchCount: 1
brainstormingCount: 1
projectDocsCount: 0
project_name: gigator
user_name: Mathieu
date: '2026-01-07T19:02:24Z'
---

# Product Requirements Document - gigator

**Author:** Mathieu
**Date:** 2026-01-07T19:02:24Z

## Executive Summary

Gigator vise à centraliser le suivi du pipeline de booking et la collaboration d’une équipe aujourd’hui dispersée entre Gmail, Google Docs et Google Sheets. Le problème n’est pas seulement l’organisation : c’est la perte de responsabilité et de visibilité, qui laisse des emails/opportunités sans traitement et fait diverger le suivi de la réalité.

Le produit est une plateforme interne **PWA (mobile-first) + dashboard web** : la PWA sert à l’exécution “terrain” (triage, relances, changements de statut) sur téléphone/desktop, et le dashboard web sert à la vue d’ensemble (pilotage du pipeline, ownership, priorités). L’intégration Gmail inclut **des actions**, afin que le workflow de booking soit piloté depuis Gigator et non “à côté” dans la boîte mail.

North star MVP : **augmenter le nombre de concerts bookés**, en réduisant les opportunités perdues par oubli, doublons de relance, ou manque d’owner.

### What Makes This Special

- Une “single source of truth” orientée action : chaque opportunité/conversation a un owner, un statut simple, et une prochaine action explicite.
- Une coordination anti-erreurs (anti-doublon, verrouillages/confirmations, traçabilité minimale) pour éviter des relances concurrentes qui nuisent à la crédibilité.
- Une boucle email→pipeline pensée pour la vitesse et la clarté : idéalement, une notification “nouveau mail” devient un contexte exploitable en quelques secondes (et, en cas d’ambiguïté, l’utilisateur résout en 2 taps via attacher/créer).

## Project Classification

**Technical Type:** web_app (PWA)
**Domain:** general
**Complexity:** low
**Project Context:** Greenfield - new project

## Success Criteria

### User Success

- **Réactivité (triage / ownership)**
  - À 3 mois : **90%** des nouveaux mails/opportunités ont une **première action** (assigné / répondu / à relancer / classé) en **< 48h**.
  - **Ownership (SLA)** : aucune opportunité sans owner au-delà de **72h**.

### Business Success

- **North Star — Concerts bookés**
  - À 3 mois : **+20%** de concerts bookés (vs baseline).
  - À 12 mois : **+40%** de concerts bookés (vs baseline).

> Note: on **ne suit pas** le taux de réponse comme metric de succès pour l’instant.

### Technical Success

- **Time-to-Context (TTC)**
  - p95 **< 10s** (définition: “tap sur notif → écran contexte prêt”).

- **Fiabilité sync & actions Gmail (qualité prod)**
  - Zéro perte silencieuse : monitoring sur erreurs d’auth/sync + capacité de reprise.
  - Idempotence: retraiter un même événement ne doit pas créer de doublons côté “opportunités / actions”.
  - Traçabilité minimale des actions Gmail : à minima enregistrer **qui / quand / sur quel thread** pour les envois et changements visibles.

### Measurable Outcomes

- Reporting mensuel (MVP) :
  - Concerts bookés (baseline vs après)
  - p95 TTC
  - % first action <48h (3 mois)
  - % opportunités sans owner >72h

## Product Scope

### MVP - Minimum Viable Product

Must-have (tes 3 priorités):
- **Ownership + anti-doublon/lock** (réduire collisions, rendre l’ownership explicite)
- **Actions Gmail** : **labels + envoi** (pas uniquement lecture)
- **Dashboard web** (vue d’ensemble/pilotage)

### Growth Features (Post-MVP)

- Pipeline + relances plus avancées (automatisations, règles, vues)
- Amélioration du TTC et de la qualité de mapping thread→salle (suggestions + validation rapide)
- Audit trail enrichi (motifs, notes, historique complet)

### Vision (Future)

- IA: suggestions (statut/owner/prochaine action) + rédaction assistée + relance intelligente

## User Journeys

**Journey 1: Camille — Triage depuis une notification jusqu’à une action Gmail (PWA - mobile)**
Camille est en déplacement. Son téléphone vibre : “nouveau mail”. Aujourd’hui, elle perd facilement le fil : la boîte partagée est pleine, et personne ne sait toujours si quelqu’un a déjà pris le sujet. Elle ouvre Gigator depuis la notification.

En arrivant, elle voit immédiatement le contexte : la salle associée, le statut du pipeline, l’owner actuel, et la prochaine action proposée. Elle lit l’extrait du dernier message et comprend qu’il faut relancer avec une précision sur la date. Sans quitter l’app, elle prépare la relance.

Au moment d’envoyer, Gigator la protège : s’il y a un risque de doublon (quelqu’un a déjà relancé récemment ou est en train de composer), l’app affiche l’alerte et le contexte. Camille confirme (ou annule), puis envoie. L’action est tracée (qui/quand/thread), le statut se met à jour, et la prochaine relance est recalculée.

**Ce que ça change** : Camille n’a plus à “fouiller Gmail” pour comprendre. Elle agit vite, sans créer de chaos.

---

**Journey 2: Camille — Edge case (mail ambigu / hors-sujet) + éviter les doublons**
Camille reçoit un mail dont le sujet est vague (“Re: dates printemps”) et le contenu mentionne une ville sans nom de salle. Elle ouvre Gigator : l’app hésite sur le rattachement. Plutôt que de laisser le mail “dans le vide”, elle choisit “Attacher à…” et relie la conversation à la bonne salle (ou crée une nouvelle opportunité).

Deux heures plus tard, un autre membre ouvre aussi la même opportunité. Sans garde-fous, chacun enverrait une relance différente. Ici, Gigator affiche clairement l’owner et l’historique d’actions Gmail. Si quelqu’un compose déjà, Camille voit le verrouillage/état et évite le doublon. Elle peut laisser une note courte ou réassigner si besoin.

**Ce que ça change** : les cas ambigus ne deviennent pas des “trous noirs”, et l’équipe évite les collisions de relance.

---

**Journey 3: Owner (membre de l’équipe) — Pilotage depuis le dashboard web + assignation + anti-doublon**
Un membre de l’équipe ouvre Gigator sur le web pour “reprendre le contrôle” du pipeline. Il voit une vue d’ensemble : opportunités sans owner, opportunités qui approchent du SLA, conversations qui n’ont pas eu de première action, et opportunités “chaudes”.

Il commence par assigner les owners sur les sujets critiques (ou se l’assigne). Ensuite, il repère une salle où deux relances risquent de partir : l’app signale une relance récente. Il vérifie le dernier thread, décide d’attendre 48h, et programme la prochaine action.

Quand un membre tente d’envoyer depuis mobile, le système applique les règles anti-doublon / lock. Le web sert de “tour de contrôle” : les décisions d’ownership et les statuts deviennent visibles et partagés.

**Ce que ça change** : le pipeline redevient pilotable, et la coordination est explicite (pas implicite dans Gmail).

---

**Journey 4: Mathieu (admin/power user) — Onboarding + config Gmail + monitoring (web)**
Mathieu veut que l’outil s’auto-maintienne et que l’équipe l’adopte. Il onboarde les membres : accès, rôles simples, et règles de base (owner obligatoire, statuts, relances).

Ensuite, il configure l’intégration Gmail : connexion, permissions, et vérifie que les actions (labels + envoi) fonctionnent. Il consulte une page de monitoring simple : état de la sync, erreurs récentes, et indicateurs de fraîcheur (est-ce que les nouveaux mails se reflètent dans Gigator).

Quand il constate une dégradation (ex: actions Gmail qui échouent), il suit un flux de récupération guidé (reconnexion, vérification des permissions), sans bloquer l’équipe.

**Ce que ça change** : l’admin n’est plus un “filet de sécurité invisible” qui rattrape les erreurs à la main.

### Journey Requirements Summary

Ces journeys révèlent des besoins clairs en capacités :

- **Deep link notification → contexte** (PWA - mobile) : ouvrir directement sur la bonne conversation/opportunité
- **Vue “contexte actionnable”** : salle, statut, owner, prochaine action, dernier message
- **Gestion de l’ambiguïté** : attacher/créer opportunité, classer hors-sujet/spam
- **Ownership + visibilité équipe** : assignation, réassignation, SLA sur “sans owner”
- **Anti-doublon / lock** : avertir/bloquer/forcer avec confirmation + preuve (qui/quand)
- **Actions Gmail (MVP)** : labels + composer/envoyer + trace minimale (qui/quand/thread)
- **Dashboard web** : pilotage du pipeline, priorisation, exceptions, relectures
- **Admin** : onboarding, configuration Gmail, monitoring et recovery simple

## Web App (PWA) Specific Requirements

### Project-Type Overview

Gigator est une **PWA (SPA)** hébergée sur une URL, destinée à être utilisée sur **téléphone et desktop**, avec un backend déployé sur **Google Cloud Run** et une pipeline **CI/CD GitHub** (déploiement sur PR mergée dans `main`).

### Technical Architecture Considerations

- **Hébergement / déploiement**
  - Frontend PWA servi via Cloud Run.
  - Déploiement automatisé via CI/CD GitHub (PR → merge `main` → déploiement).

- **Temps réel**
  - Le produit doit supporter des **mises à jour en temps réel** (ex: changements owner/statut, relance effectuée) sur les écrans web/PWA, afin d’éviter les doublons et incohérences d’équipe.

### Browser Support Matrix

- Navigateurs cibles (dernières versions uniquement) :
  - **Chrome**
  - **Edge**
  - **Safari**, incluant **Safari iOS** (usage PWA)

### Responsive Design

- Approche **mobile-first** : expérience optimisée téléphone (triage, actions rapides) tout en restant efficace sur desktop (listes, vues d’ensemble).
- Mise en page responsive pour les vues critiques : opportunités, thread Gmail, composer, dashboard.

### Performance Targets (Web Vitals)

Objectifs MVP (p75) :
- **LCP < 2.5s**
- **INP < 200ms**
- **CLS < 0.1**

### SEO Strategy

- **SEO non requis** (produit interne, accès via URL dédiée).

### Accessibility Level

- Accessibilité **basique** (lisibilité, contrastes raisonnables, navigation clavier sur web quand applicable).

### Implementation Considerations

- Push notifications (PWA) : notifications pour **nouveau mail** et **relance due** (selon support navigateur/OS), avec fallback produit si nécessaire.
- Contrainte clé : cohérence multi-utilisateur (temps réel + anti-doublon/lock) > “feature count”.

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Experience MVP
- Objectif : livrer rapidement l’expérience “notif → contexte → action” (PWA) + une tour de contrôle (dashboard) qui empêche les doublons.
- Critère de réussite produit prioritaire : coordination fiable (ownership, anti-doublon) + action Gmail possible depuis Gigator.

**Resource Requirements:** 2 devs fullstack
- Compétences minimales : PWA/SPA + backend Cloud Run, intégration Gmail (OAuth/scopes, envoi), temps réel (websocket/SSE ou équivalent), modèle de données + audit trail.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- Camille : triage depuis notif → contexte → action Gmail (PWA)
- Camille : edge cases (ambigu/hors-sujet) + éviter doublon
- Owner (membre équipe) : dashboard web → assignation → pilotage + prévention doublons
- Mathieu (admin) : onboarding + config Gmail + monitoring/recovery

**Must-Have Capabilities:**
- **PWA (SPA) mobile-first** (fonctionne aussi desktop)
- **Temps réel** sur les états critiques : owner, statut pipeline, “relance en cours/récente”
- **Ownership + SLA** (pas d’opportunité sans owner >72h)
- **Anti-doublon/lock** sur actions sensibles (composer/envoyer) avec avertissement + preuve (qui/quand)
- **Actions Gmail (MVP)** : labels + composer/envoyer + traçabilité minimale (qui/quand/thread)
- **Dashboard web** : vue d’ensemble, priorisation, exceptions (sans owner, proches SLA, relances dues)
- **Notifications** : nouveau mail + relance due (avec fallback si push PWA limité selon OS/navigateur)

### Post-MVP Features

**Phase 2 (Post-MVP):**
- Pipeline + relances avancées (règles, vues, automatisations)
- Amélioration mapping thread→salle (suggestions + validation rapide)
- Audit trail enrichi (notes/motifs)

**Phase 3 (Expansion):**
- IA: suggestions (statut/owner/prochaine action), rédaction assistée, relance intelligente

### Risk Mitigation Strategy

**Technical Risks (Risque #1 : temps réel + anti-doublon/lock)**
- Définir des règles simples et testables : “relance récente” + “lock en cours” + conditions de forçage.
- Mettre en place un mécanisme temps réel minimal sur les états critiques (owner/statut/lock).
- Traçabilité systématique des actions critiques pour diagnostiquer les collisions.

**Market Risks**
- Risque principal : adoption interne (discipline d’owner + mise à jour statuts).
- Mitigation : frictions minimales (2–3 clics max), vues “à traiter”, notifications, et dashboard qui rend les oublis visibles.

**Resource Risks**
- Si la capacité baisse : réduire le périmètre “nice-to-have” (géoloc, features avancées de relance), et préserver le noyau (ownership + anti-doublon + actions Gmail + dashboard).

## Functional Requirements

### User Access & Team Setup

- FR1: [Admin] can invite team members to the workspace.
- FR2: [Admin] can deactivate/reactivate a team member.
- FR3: [User] can authenticate to access the application.
- FR4: [User] can view their profile and basic workspace settings.

### Venue Directory (Salles/Lieux)

- FR5: [User] can create a venue (salle/lieu) record.
- FR6: [User] can view a venue’s details.
- FR7: [User] can edit a venue’s core fields (name, city, notes).

### Contacts Directory (multi-canaux)

- FR8: [User] can create/edit/delete a contact.
- FR9: [User] can link a contact to one or more venues and view those associations.
- FR10: [User] can store contact channels (email, phone, Instagram, in-person) and associated notes.

### Opportunities & Pipeline

- FR11: [User] can create an opportunity associated to a venue.
- FR12: [User] can edit an opportunity’s core fields (status, notes, next action, follow-up due date).
- FR13: [User] can mark an opportunity as won/confirmed.
- FR14: [User] can mark an opportunity as lost.

### Gmail Integration (Sync + Context)

- FR15: [Admin] can connect the workspace to a Gmail mailbox for syncing.
- FR16: [System] can ingest new Gmail messages/threads and make them visible in the product.
- FR17: [User] can view the latest email context for a venue/opportunity.
- FR18: [User] can attach an email thread to an existing venue/opportunity.
- FR19: [User] can create a new opportunity from an email thread.
- FR20: [User] can classify an email thread as irrelevant/spam so it does not pollute the booking pipeline.

### Gmail Actions (Labels + Send)

- FR21: [User] can apply predefined Gmail labels (or equivalent treated markers) from within the product.
- FR22: [User] can compose an outbound email reply/relance linked to a specific venue/opportunity.
- FR23: [User] can send the composed email via Gmail from within the product.
- FR24: [System] can record a trace of each Gmail action (who, when, which thread/opportunity).

### Non-email Interactions (appels / DM / IRL)

- FR25: [User] can log a non-email interaction (call, Instagram DM, in-person meeting) against a venue/opportunity with timestamp and notes.
- FR26: [User] can view interaction history for a venue/opportunity across email + non-email.

### Ownership, Collaboration, and Anti-Duplicate Controls

- FR27: [User] can assign an owner to an opportunity.
- FR28: [User] can reassign ownership between team members.
- FR29: [System] can surface opportunities with missing owner and how long they have been unowned.
- FR30: [System] can enforce anti-duplicate protections for sensitive actions (e.g., sending a relance) by detecting “recently sent” or “in progress”.
- FR31: [User] can see who last acted on an opportunity before sending.
- FR32: [User] can override a conflict protection only through an explicit confirmation step.

### Next Actions and Follow-ups

- FR33: [User] can define a next action and a follow-up due date for an opportunity.
- FR34: [System] can surface follow-ups that are due/overdue.

### Notifications & Attention Management

- FR35: [User] can receive notifications for “new mail” events.
- FR36: [User] can receive notifications for “follow-up due” events.
- FR37: [User] can open the app from a notification and land on the relevant context.

### Web Dashboard (Pilotage)

- FR38: [User] can view a dashboard summarizing pipeline health (e.g., unowned items, items approaching SLA, due follow-ups).
- FR39: [User] can filter/sort opportunities by owner, status, and urgency.
- FR40: [User] can drill down from dashboard lists into the detailed context of a specific opportunity.

### Real-Time Collaboration Visibility

- FR41: [System] can reflect critical state changes (owner, status, lock state, recent relance) to other active users without requiring a manual page refresh.

### Admin, Monitoring, and Recovery

- FR42: [Admin] can view current integration health status (connected/disconnected, last sync time, recent errors).
- FR43: [Admin] can trigger an integration recovery action (e.g., re-auth / reconnect) when sync or actions fail.

### Audit & Activity History

- FR44: [User] can view an activity log for an opportunity (ownership changes, status changes, Gmail actions, non-email interactions).
- FR45: [System] can keep an immutable record of critical actions for accountability.

### Search & Navigation

- FR46: [User] can search for venues/opportunities/contacts by name/keywords.
- FR47: [User] can navigate between “triage/inbox”, “pipeline”, “dashboard”, and “directory” views.

## Non-Functional Requirements

### Performance

- **Time-to-Context (TTC)** : p95 < 10s (tap sur notif → écran contexte prêt).
- **PWA page load** : p75 < 2s pour charger la page “opportunité/thread” (hors latence Gmail).
- **Temps réel (propagation)** : les changements critiques (owner/statut/lock/relance récente) sont visibles pour les autres utilisateurs en < 3s.

### Reliability

- **Disponibilité** : 99.5% uptime (MVP).
- **Recovery** : RPO = 1h ; RTO = 4h.

### Security

- **Authentification** : Google Login obligatoire (Workspace).
- **Contrôle d’accès** : accès restreint via whitelist d’emails.
- **Chiffrement** : TLS en transit + chiffrement au repos (données + secrets).
- **Tokens Gmail** : stockage chiffré + rotation/révocation supportées.

### Scalability

- **Utilisateurs simultanés** : support de 5 utilisateurs concurrents.
- **Volume email** : 5–20 emails/jour (mailbox).

### Integration

- **SLO ingestion Gmail** : p95 < 30s entre “mail reçu” et “visible dans Gigator”.

### Accessibility

- Niveau **basique** (pas d’objectif WCAG AA au MVP).
