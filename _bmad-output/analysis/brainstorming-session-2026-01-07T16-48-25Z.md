---
stepsCompleted: [1, 2]
inputDocuments: []
session_topic: "Application interne mobile pour gérer le booking des concerts de Barely Blue"
session_goals: "Centraliser lieux/salles, contacts, pipeline de booking, notes + exécution (tâches, relances, assignations) ; synchroniser automatiquement la boîte mail partagée (Gmail/IMAP) et relier les échanges aux salles/concerts ; usage mobile-first."
selected_approach: "ai-recommended"
techniques_used: ["Question Storming", "Role Playing", "Morphological Analysis"]
ideas_generated: []
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Mathieu
**Date:** 2026-01-07T16:48:55Z

## Session Overview

**Topic:** Application interne mobile pour gérer le booking des concerts de Barely Blue
**Goals:** Centraliser le suivi + l’exécution du booking, et intégrer automatiquement l’email (Gmail/IMAP) pour que tout le monde voie le dernier contexte, surtout sur téléphone.

### Session Setup

- Point de départ actuel : Google Sheet + boîte mail partagée, avec perte de contexte entre membres.
- Contraintes implicites : simple à utiliser en mobilité, historique d’échanges accessible par salle/concert, éviter doublons et relances incohérentes.

## Technique Selection

**Approach:** AI-Recommended Techniques
**Timebox choisi:** 45 minutes
**Analysis Context:** app mobile-first Barely Blue + pipeline/exécution + sync email (Gmail/IMAP) dès le début.

**Recommended Techniques:**
- **Question Storming (deep):** clarifier les inconnues (intégration email, droits, sync mobile/offline, responsabilités) et transformer ça en backlog de décisions.
- **Role Playing (collaborative):** faire émerger les scénarios réels multi-utilisateurs (boîte partagée) et écrire des user stories concrètes.
- **Morphological Analysis (deep):** cartographier les dimensions du produit et générer 2–3 combinaisons “MVP vs v1” cohérentes.

**AI Rationale:** séquence pensée pour éviter le piège “on code une app” sans cadrer le système (email + collaboration), tout en aboutissant à des options actionnables rapidement.

## Technique Execution (in progress)

### Technique 1 — Question Storming (questions brutes)

**Questions initiales de Mathieu (sans réponses, juste cadrage) :**
- Q: Comment rendre l'expérience multi-utilisateur ?
- Q: Comment notifier les utilisateurs d'un changement (nouveau mail, nouveau concert prévu, ...) ?
- Q: Comment afficher ces éléments ? (Carte, tableau, liste)
- Q: Comment persister ces informations ?
- Q: Comment se connecter à l'application ?
- Q: Qui a le droit de modifier ? Existe t'il des roles ?
- Q: Quelles sont les informations d'un évènement à afficher ?


### Question Storming — élément 2 (email + collaboration)

**Questions additionnelles (Mathieu) :**
- Q: Comment relier automatiquement un thread à une salle ?
- Q: Envoi des emails depuis l'app ou lecture seule ?
- Q: Gestion des pieces jointes ?
- Q: Historique complet ou derniers échanges ?
- Q: Comment tracer qui a envoyé quoi et quand ?
- Q: Comment gérer les conflits d'édition ?
- Q: Qu'est ce qui doit marcher offline ?
- Q: Comment synchroniser les changements quand on revient en ligne ?

**Top 2 (les plus critiques/risquées) :**
- Q: Comment tracer qui a envoyé quoi et quand ?
- Q: Comment relier automatiquement un thread à une salle ?


### Question Storming — élément 3 (compléments)

**Questions ultra-ciblées (Mathieu) :**
- Q1: Comment gérer le pipeline (contacté, en cours, validé, refusé, etc) ?
- Q2: Comment gérer les changements de contacts ?
- Q3: Comment afficher de manière élégante les concerts programmés ?
- Q4: Comment gérer les mails qui n'ont pas de rapport avec le booking de concert ? (spams)
- Q5: Comment relier un thread à un concert précis quand il y a plusieurs dates avec la même salle ?


### Technique 2 — Role Playing (mobile) : Scénario + User Story

**Rôle incarné :** Membre en tournée (mobile)

**Situation :**
Je reçois une notification “nouveau mail”, mais je ne sais pas à quel concert/salle ça correspond. J’ouvre l’app et je veux comprendre immédiatement le contexte et l’action à faire.

**User Story (Mobile triage & contexte email) :**
En tant que **membre en tournée**,
je veux qu’en ouvrant l’app après une notif “nouveau mail”, je voie en **moins de 10 secondes** à quel **concert/salle** ce mail est lié, avec le **statut** et la **prochaine action**,
afin de prendre la bonne décision (relancer/attendre/appeler) sans fouiller la boîte mail.

**Critères d’acceptation :**
- L’écran d’arrivée (depuis la notif) affiche : **Salle**, **Concert (date/ville)**, **statut pipeline**, **dernier message reçu**, **responsable**, **prochaine action**.
- Si l’app est **incertaine/ambiguë** sur le rattachement :
  - elle propose **2–3 matchs** pertinents (suggestions),
  - un bouton **“Attacher à…”**,
  - un bouton **“Créer nouvelle opportunité”**.
- Objectif UX : **2 taps max** pour résoudre une ambiguïté (attacher ou créer).
- Le mail peut être **marqué hors-sujet/spam** (triage) afin de ne pas polluer le pipeline booking.


### Technique 2 — Role Playing (coordinateur) : Scénario + User Story

**Rôle incarné :** Coordinateur (éviter doublons, assigner, piloter pipeline)

**Situation :**
Deux membres relancent la même salle le même jour avec deux messages différents. La salle est perdue et la crédibilité du groupe en prend un coup.

**User Story (Ownership & anti-doublon de relance) :**
En tant que **coordinateur**,
je veux que l’app empêche (ou rende quasi-impossible) une **double relance** sur la même salle/concert,
afin de garder une communication cohérente et éviter les erreurs de coordination.

**Critères d’acceptation :**
- Un concert/opportunité a un **owner** (responsable) clairement visible.
- Avant l’envoi d’une relance, l’app vérifie si :
  - une relance a déjà été envoyée “récemment” (fenêtre de temps configurable),
  - ou si quelqu’un est “en train de relancer” (état / verrouillage temporaire).
- Si une relance concurrente est détectée :
  - l’app **bloque** l’action OU demande une confirmation explicite,
  - et affiche : “Relance en cours / récente par [membre] à [heure]” + accès au dernier message.
- L’utilisateur peut **(ré)assigner** l’owner (avec traçabilité) quand nécessaire.
- L’app conserve un **audit trail** minimal sur les actions critiques : assignation, changement de statut, envoi de relance (qui/quand/quoi).


### Technique 2 — Role Playing (booker) : Scénario + User Story

**Rôle incarné :** Booker (envoie/relance, gère les réponses)

**Situation :**
Je veux relancer une salle X pour une date en avril. Avant d’envoyer, je dois voir le dernier mail/thread, la dernière relance (qui/quand), le statut du pipeline, et si quelqu’un d’autre est déjà dessus. J’ai peur d’envoyer un doublon ou un message pas aligné avec le dernier échange.

**User Story (Pré-envoi “safe to send”) :**
En tant que **booker**,
je veux un écran de pré-envoi qui me montre le **contexte complet** (dernier thread + dernière relance + owner + statut),
afin d’envoyer une relance cohérente et d’éviter les doublons.

**Critères d’acceptation :**
- Avant l’envoi, l’app affiche (sur 1 écran) :
  - **Dernier thread / dernier message** lié à la salle/concert (ou lien direct vers celui-ci),
  - **Dernière relance** (qui/quand) + extrait du message envoyé,
  - **Owner actuel** + indication “en cours de relance” si applicable,
  - **Statut pipeline** et **prochaine action**.
- Si une relance a été envoyée “récemment” (fenêtre de temps configurable) :
  - l’app affiche un avertissement clair,
  - et propose soit **bloquer** soit “forcer l’envoi” avec confirmation explicite.
- Lorsqu’un booker ouvre le mode “composer”, l’app peut créer un **verrouillage temporaire** (“je prends la main”) visible par les autres membres.
- Chaque envoi enregistre un **log** minimal (qui/quand/à propos de quelle salle/concert) pour permettre audit et coordination.


## Technique 3 — Morphological Analysis (MVP vs v1)

### Choix de Mathieu (A–H)
- A1 — Email: Gmail API uniquement
- B1 — Rattachement thread→salle/concert: manuel obligatoire (“attacher à…”)
- C1 — Ownership/anti-doublon: owner obligatoire + verrouillage “compose” (soft lock)
- D1 — Audit: minimal (qui/quand sur actions critiques)
- E3 — Modèle principal: Salle centrale + pipeline par salle
- F3 — UI principale: Agenda / liste des dates (badges emails)
- G2 — Notifications: Push + digest quotidien
- H3 — Offline: pas d’offline au début

### Lecture rapide (forces / risques)
**Forces**
- Très robuste contre les erreurs de matching (B1) et contre les doublons (C1).
- Simplicité de mise en œuvre: Gmail API (A1), audit minimal (D1), pas d’offline (H3).

**Risque majeur**
- B1 (manuel) peut nuire à la promesse “notif → contexte en 10s”, car il faut d’abord classer/attacher les threads.

---

## Configuration 1 — MVP “safe & simple” (conforme à tes choix)
**But:** sortir vite un produit utile sans explosion de complexité.

- Email: Gmail API uniquement (A1)
- Rattachement: Manuel obligatoire (B1)
- Coordination: owner + soft lock compose (C1)
- Audit: minimal (D1)
- Data model: Salle centrale + pipeline par salle (E3)
- UI: Agenda (F3)
- Notifs: push + digest (G2)
- Offline: non (H3)

**Ce que ça protège**
- Erreurs de rattachement (car on attache à la main)
- Doublons de relance (owner + verrouillage)
- “Qui a fait quoi” minimal (audit)

**Ce que ça sacrifie**
- Fluidité inbox: tout mail doit être trié/attaché pour délivrer la valeur.

---

## Configuration 2 — v1 “mobile efficace” (petit saut de valeur sans gros risque)
**Changement clé recommandé:** B2 au lieu de B1 (auto-suggestion + validation).

- Email: A1
- Rattachement: **B2** (2–3 suggestions + validation en 2 taps max)
- Coordination: C1
- Audit: D1 (ou D3 si tu veux noter “pourquoi”)
- Data model: E3
- UI: F3 (agenda) + section “À trier”
- Notifs: G2
- Offline: H3

**Pourquoi c’est le bon compromis**
- Tu gardes la fiabilité (l’humain confirme) tout en respectant la promesse “notif → contexte en 10s”.
- Ça colle exactement à la user story “ambigu: proposer 2–3 matchs + attacher/créer”.

---

## Configuration 3 — “ambitieuse mais risquée” (à ne faire que si le MVP tourne)
**But:** réduire au maximum le tri manuel, au prix de complexité.

- Email: A3 (Gmail API + fallback IMAP) ou rester A1 mais enrichir extraction
- Rattachement: B3 (règles domaines/contacts) + B2 (suggestions) et corrections rapides
- Coordination: C3 (hard lock court) si vous avez beaucoup de collisions
- Audit: D3 (notes d’action) pour responsabilité et contexte
- Data model: E1 (opportunité→concert) OU E3 + “dates” sous la salle
- UI: F1 (Inbox booking) + F3 (agenda) en 2 onglets
- Notifs: G2
- Offline: H1 (lecture offline) voire H2 plus tard

**Risques**
- Matching plus fragile, besoin d’outils de correction ultra-rapides
- Complexité technique et UX (faut rester simple)

---

### Décision proposée
- **MVP = Configuration 1** (ton choix) si vous acceptez un tri manuel au départ.
- Sinon, si l’objectif “tout le monde est au courant” est prioritaire, **v1 = Configuration 2** est le meilleur compromis (suggestion + validation).

