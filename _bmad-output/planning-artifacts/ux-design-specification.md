---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
lastStep: 14
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/product-brief-gigator-2026-01-07.md
  - _bmad-output/planning-artifacts/research/technical-integration-gmail-api-boite-mail-partagee-auth-scopes-sync-threads-pieces-jointes-audit-trail-research-2026-01-07.md
project_name: gigator
user_name: Mathieu
date: '2026-01-07T19:57:26Z'
---

# UX Design Specification gigator

**Author:** Mathieu  
**Date:** 2026-01-07T19:57:26Z

---

<!-- UX design content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

### Project Vision

Gigator est une plateforme interne (PWA mobile-first + dashboard web) qui centralise le pipeline de booking aujourd’hui dispersé entre Gmail, Google Docs et Google Sheets.
Sa promesse UX : transformer des échanges email en décisions d’équipe actionnables (owner, statut simple, prochaine action), en réduisant les “trous noirs” (emails/opportunités sans traitement) et les erreurs de coordination (doublons de relance, statuts divergents).
Le produit doit favoriser une exécution rapide depuis notification (“notif → contexte → action”) tout en gardant une vue d’ensemble pilotable via un dashboard.

### Target Users

- Membre de l’équipe / booker polyvalent (ex: Camille)
  - Contexte : en mobilité, besoin de traiter vite et bien ; risque élevé de “se marcher dessus” dans une boîte partagée.
  - Objectifs : triage rapide, envoyer/relancer sans erreur, savoir “quoi faire maintenant”, contribuer sans charge mentale.
  - Environnement : mobile + desktop ; notifications ; actions courtes et fréquentes.

- Admin / power user (ex: Mathieu)
  - Contexte : configure/maintient le système et garantit sa fiabilité.
  - Objectifs : adoption de l’équipe, règles simples qui s’auto-maintiennent, monitoring + recovery Gmail.
  - Environnement : plutôt web/dashboard, besoin de visibilité globale et d’outils d’administration.

### Key Design Challenges

1) Vitesse + clarté sous contrainte (Time-to-Context)
- En 10 secondes max, l’utilisateur doit comprendre : quel lieu, quel statut, qui est owner, et quelle est la prochaine action.
- Minimiser les décisions lourdes (“où classer ce thread ?”) tout en gérant l’ambiguïté (attacher/créer/classer).

2) Coordination multi-utilisateur (anti-doublon / lock) sans casser le flux
- Prévenir les collisions (relance récente / en cours) avec une UX “protectrice” : preuve, contexte, et confirmation explicite pour forcer.
- Visibilité temps réel (owner/statut/lock/relance récente) pour éviter les actions simultanées.

3) Cohérence email ↔ pipeline (Gmail avec actions)
- Garder la confiance utilisateur : ce que je vois dans Gigator est vrai, et ce que j’envoie/labelise depuis Gigator est tracé et reflété dans Gmail.
- Design d’erreurs et de recovery (auth, sync, send) : pas de “perte silencieuse”, chemins de rattrapage simples.

### Design Opportunities

1) “Contexte actionnable” ultra-compact
- Un écran “thread/opportunité” optimisé mobile : aperçu dernier message + statut/owner + prochaine action + CTA principal (répondre/relancer/assigner).

2) Inbox/triage orientée décisions (pas une boîte mail bis)
- Triage guidé : attacher à une salle, créer opportunité, classer hors-sujet, assigner owner — en 2–3 gestes.
- Suggestions (sans IA au MVP) via règles simples : “probable salle”, “relance due”, “sans owner”.

3) Dashboard comme tour de contrôle
- Listes “à traiter” (sans owner, proches SLA, relances dues) avec actions rapides (assigner, planifier prochaine action, ouvrir contexte).
- Mise en évidence de la santé du pipeline (fiabilité du suivi) plutôt que volume d’emails.

## Core User Experience

### Defining Experience

L’expérience cœur de Gigator est une machine à transformer une boîte mail partagée en actions d’équipe claires, en réduisant deux risques majeurs : (1) les conversations qui “dorment” faute de triage/ownership, (2) les collisions (doublons de relance) qui dégradent la crédibilité.
Le cœur du produit n’est pas “lire des emails” : c’est décider vite, rendre visible, et agir de façon coordonnée.

### Platform Strategy

- PWA **mobile-first** : interactions courtes, utilisables à une main, optimisées pour le toucher.
- Priorité : “notification → triage → action” sans friction, avec chargement rapide (TTC p95 < 10s).
- Pas de mode offline au MVP : la cohérence (temps réel, état des locks, actions Gmail) prime sur la disponibilité hors-ligne.

### Effortless Interactions

1) Inbox / Triage (attacher / créer / classer)
- Voir immédiatement “de quoi il s’agit” (dernier message + indices de contexte) et prendre une décision en 2–3 gestes.
- Gérer l’ambiguïté sans coût mental : rechercher une salle, choisir “attacher”, ou “créer opportunité”, ou “classer hors-sujet”.

2) Composer / Envoyer (avec anti-doublon)
- Composer/répondre depuis le contexte de l’opportunité, avec une confiance maximale (“je ne vais pas envoyer un doublon”).
- Si risque : alerte claire + preuve (qui/quand/quoi) + action guidée (annuler, attendre, ou forcer via confirmation explicite).

### Critical Success Moments

- Moment “aha” : depuis une notif, l’utilisateur arrive sur un écran qui lui dit immédiatement quoi faire (et qui s’en occupe), et il peut trier/agir sans ouvrir Gmail.
- Moment “confiance” : envoyer une relance en sachant que personne n’a déjà envoyé/est en train de composer (anti-doublon/lock + temps réel).
- Moment “anti trou noir” : un thread ambigu est quand même capturé (attach/create/classer) au lieu de rester “en suspens” dans la boîte partagée.

### Experience Principles

- “Décider vite, tracer juste” : privilégier des choix simples, visibles, et actionnables, avec traçabilité minimale mais fiable.
- “Mobile-first, friction minimale” : 2–3 gestes max pour triage et actions courantes, progressive disclosure pour le détail.
- “Protection sans punition” : empêcher les collisions sans bloquer le travail ; forçage possible mais toujours conscient et justifié.
- “Single source of truth en temps réel” : owner, statut, lock et relance récente doivent être lisibles et synchronisés, sinon la confiance s’effondre.

## Desired Emotional Response

### Primary Emotional Goals

- Calme + clarté pendant le triage : “je sais quoi faire maintenant”.
- Confiance au moment d’envoyer : “je n’envoie pas un doublon, je suis protégé par le système”.

### Emotional Journey Mapping

- Découverte / retour dans l'app : sentiment de “tour de contrôle” (tout est lisible, pas de chaos).
- Triage (attacher / créer / classer) : fluidité et absence d’hésitation (décisions simples, guidées).
- Action (composer/envoyer) : sécurité et assurance (signaux de contexte, protections anti-doublon visibles).
- Après action : soulagement / satisfaction (“c’est traité, c’est tracé, l’équipe est alignée”).
- En cas de problème (sync/envoi/lock) : apaisement (“ce n’est pas grave”) + reprise immédiate (“voici quoi faire”).

### Micro-Emotions

- Confiance > doute : l’état (owner/statut/lock) doit paraître “vrai”.
- Clarté > confusion : une décision principale par écran, vocabulaire simple.
- Sérénité > anxiété : feedback immédiat, pas d’échec silencieux.
- Absence de culpabilité : les collisions sont traitées comme un problème d’équipe/système, jamais comme une faute utilisateur.

### Design Implications

- Calme + clarté → hiérarchie visuelle forte (CTA principal unique), texte court, états explicites (sans owner / relance due / lock en cours).
- Confiance → mécanismes “safety by default” :
  - affichage visible des signaux anti-doublon (relance récente / composition en cours),
  - preuve simple (qui/quand) avant un envoi risqué,
  - confirmation explicite pour forcer.
- Éviter culpabilité → messages neutres (“Risque de doublon détecté”) + options guidées (attendre, ouvrir le dernier message, forcer).
- Bug/recovery (ton rassurant + actionnable) → microcopy en 2 parties :
  - diagnostic court (“Impossible d’envoyer : connexion Gmail expirée”),
  - action immédiate (“Reconnecter Gmail”, “Réessayer”, “Enregistrer en brouillon”).

### Emotional Design Principles

- “Rendre l’incertitude explicite” : si le système doute (mapping, sync), il le dit et propose une action.
- “Protéger sans dramatiser” : prévenir les collisions calmement, et permettre de continuer.
- “Toujours une sortie” : chaque écran d’erreur propose un chemin de récupération simple.
- “Feedback immédiat” : chaque action clé produit une confirmation claire (et traçable).

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

- Slack
  - Forces UX: notifications claires, contexte de conversation, micro‑interactions (réactions), état de présence, triage rapide via threads et mentions.
  - Leçon pour Gigator: notifications actionnables et visibilité “qui fait quoi” pour éviter les collisions.

- Gmail
  - Forces UX: aperçu rapide du thread, labels simples, composer intégré, fiabilité perçue.
  - Leçon pour Gigator: affichage compact du dernier message + CTA “répondre / appliquer label” depuis le contexte.

- Trello
  - Forces UX: cartes visuelles, actions rapides (assigner, checklist), priorisation par colonnes, filtres simples.
  - Leçon pour Gigator: dashboard pipeline visuel avec actions rapides pour assigner/prioriser et repérer “sans owner”.

### Transferable UX Patterns

- Notification → Contexte → Action (Slack / Gmail)
  - Pattern: notification ouvre un contexte compact (dernier message + métadonnées) et un CTA principal.
  - Application: écran “notif → opportunité” montrant owner, statut, prochaine action et un CTA unique.

- Micro-actions & Progressive Disclosure (Slack / Trello)
  - Pattern: montrer l’action principale puis révéler options secondaires.
  - Application: triage avec CTA principal (Attacher / Créer / Classer) et options secondaires en “more”.

- Visual pipeline & Quick Filters (Trello)
  - Pattern: cartes + filtres pour prioriser.
  - Application: dashboard web avec listes “sans owner”, “proches SLA”, “relances dues”.

- Explicit State & Provenance (Gmail)
  - Pattern: montrer preuve (qui / quand) pour bâtir la confiance.
  - Application: preuve visible anti-doublon avant envoi (qui/quand).

### Anti-Patterns to Avoid

- Reproduire une “boîte mail bis” (duplicating Gmail without simplification).
- Notifications bruyantes et non-actionnables.
- Dialogues de triage lourds pour opérations courantes.
- Messages d’erreur culpabilisants qui blâment l’utilisateur.

### Design Inspiration Strategy

- À adopter:
  - Notification → contexte compact + CTA principal (inspiré Gmail / Slack).
  - Dashboard visuel filtrable pour pilotage (inspiré Trello).
  - Indicateurs de preuve (qui/quand) visibles avant actions sensibles.

- À adapter:
  - Simplifier la métaphore “carte” de Trello pour mobile (éviter colonnes horizontales complexes).
  - Utiliser threads pour historique mais prioriser le résumé actionnable (inspiré Slack).

- À éviter:
  - Reproduire l’interface complète d’un client mail sur mobile.
  - Notifications sans contexte/action disponible.


## Design System Foundation

### 1.1 Design System Choice

- Choice: Themeable System (Tailwind CSS + design tokens + small UI component kit).

### Rationale for Selection

- Rapid MVP development with flexibility to brand later (Aestico + logo).
- Low maintenance overhead with tokens and utility-first approach.
- Fits PWA mobile-first + dashboard web constraints and small team.

### Implementation Approach

- Design tokens (YAML/JSON): colors, typography, spacing, radii, shadows.
  - Example tokens (defaults):
    - background: #FFFFFF
    - text: #000000
    - accent: #0A66C2 (placeholder)
    - surface, muted, success, warning, danger tokens
    - typeScale: 16 / 18 / 24 / 32 (base / small / h3 / h2)
- Integrate tokens into Tailwind config (map tokens → CSS variables → utilities).
- Deliver a minimal component set for MVP:
  - TopBar / Notification entry point
  - Opportunity Card / Thread Preview
  - Composer modal (reply/compose)
  - Quick Triage actions (Attach / Create / Classify)
  - Dashboard Lists (sans owner / proches SLA / relances dues)
  - Badge / Lock indicator, Toasts / Alerts
- Provide minimal docs: tokens.md, component-primitives.md, usage examples (mobile + desktop).

### Customization Strategy

- Default: white background, black text, neutral accent placeholder.
- When Aestico + logo are provided: replace typography tokens (@font-face / preload) and update tokens accordingly.
- Accessibility: ensure color contrast, responsive root font sizes, touch targets ≥ 44px.

### Next Steps

- Fournir : police Aestico (fichier ou nom) + logo (optionnel) + confirmation pour couleur accent si tu veux définir maintenant.
- Après validation : je génère la section complète et on passe à la définition des écrans clés.

## 2. Core User Experience

### 2.1 Defining Experience

Le defining experience de Gigator est : "Transformer une notification email en une décision actionnable en quelques secondes" — i.e. permettre à un membre de l'équipe, depuis une notif ou l'inbox, de trier rapidement une conversation (attacher / créer / classer) et d'agir (composer/envoyer) en toute confiance sans créer de doublon.

### 2.2 User Mental Model

- Les utilisateurs considèrent les emails comme des "tâches" : chaque thread doit devenir une opportunité traçable.
- Ils attendent une action rapide depuis leur téléphone : aperçu du dernier message + métadonnées suffisantes pour décider.
- Ils craignent les doublons et les actions non-synchronisées : preuve et état visibles (qui/quand/lock) sont essentiels.
- Flux mental : notifier → comprendre le contexte → choisir l'action la plus évidente → exécuter → voir la trace.

### 2.3 Success Criteria

- TTC (tap → contexte prêt) : p95 < 10s.
- Triage (notif → action de triage) réalisable en ≤ 3 taps dans 80% des cas.
- Première action sur nouvel item <48h pour 90% des nouveaux mails.
- Zéro doublon créé par des envois depuis Gigator (idempotence garantie).

### 2.4 Novel UX Patterns

- Anti-doublon proofing : vérifier et afficher preuve (qui/quand/draft) avant envoi; proposer options claires (Attendre / Voir draft / Forcer).
- Triage action sheet mobile-first : CTA principal visible (Attacher / Créer / Classer) + progressive disclosure pour options avancées.
- Dashboard "pipeline as action list" : listes filtrables (sans owner / proches SLA / relances dues) avec actions rapides (assigner / planifier).

### 2.5 Experience Mechanics

1) Initiation
- Trigger principal : push notification ou ouverture de l'inbox PWA.
- Alternatif : ouverture directe du thread depuis notification (deep link).

2) Interaction
- Écran détail compact : dernier message, salle suggérée (si any), statut, owner, next action, indicateur lock/relance récente.
- CTA principal : Quick Action (Attacher / Créer / Classer) ; secondary : Composer (modal).
- Recherche/sélection de salle via autocomplete si nécessaire.

3) Feedback
- Anti-doublon check en temps réel avant envoi ; si conflit, modal avec preuve + options.
- Après action : toast "Action enregistrée" + mise à jour visible (owner/statut) et propagation realtime.
- Erreurs : message court + action de recovery (Reconnecter / Réessayer / Enregistrer en brouillon).

4) Completion
- L'utilisateur voit confirmation visible dans l'UI (badge/status) et l'item reflète la nouvelle propriété (owner/statut).
- L'action est tracée (qui/when/thread) pour audit minimal.


## Visual Design Foundation

### Color System

- Palette initiale (placeholders, remplaçables) :
  - background: #FFFFFF
  - text (primary): #000000
  - surface / card: #F7F8FA
  - muted text / borders: #6B7280
  - accent (placeholder discret) : #0A66C2
  - success / warning / danger : #10B981 / #F59E0B / #EF4444
- Règles sémantiques : utiliser tokens (primary, secondary, surface, muted, inverse). Limiter les couleurs en MVP.
- Accessibilité : vérifier contrastes (AA minimal pour texte normal).

### Typography System

- Placeholder (tant que Aestico non fournie) :
  - Titres : Inter (weight 600/700) / fallback system
  - Corps : System UI / Roboto / fallback (weight 400/500)
- Quand Aestico fourni : remplacer tokens typographiques (font-family, font-weight mapping, @font-face + preload).
- Type scale (mobile-first) — base = 16px :
  - h1: 32px (mobile) / 40px (desktop)
  - h2: 24px / 32px
  - h3: 18px / 24px
  - body: 16px
  - caption: 14px
- Line-heights : body lh 1.5 ; headings tighter but readable.

### Spacing & Layout Foundation

- Base spacing unit : 8px (scale 4 / 8 / 16 / 24 / 32).
- Layout principles :
  - Mobile : single column, edge gutters 16px, touch targets ≥ 44px.
  - Desktop : constrained content width for detail pages (max 960–1120px); dashboard grid for lists.
- Component spacing rules : card padding 12–16px (mobile), stack gaps via scale.

### Component tokens & primitives

- Tokens à exposer : --color-bg, --color-text, --color-accent, --space-1..5, --radius, --shadow-1.
- Primitives prioritaires : Button (primary/secondary/ghost), Card, List item, Modal, Toast, Badge/Lock indicator, Input/autocomplete.
- Affordances : CTA principal high-contrast ; secondary muted.

### Accessibility & Performance

- Contrast >= 4.5:1 pour texte normal vs background.
- Preload fonts (Aestico) pour éviter FOIT ; fournir fallback système en attendant.
- Optimiser pour LCP/INP : garder composants légers et minimiser ressources dans l'écran critique.

### Micro-guidelines (exemples)

- Triage screen CTA : single primary action visible (48px height), secondary actions en overflow.
- Composer : focus state prominent, autosave drafts visible.
- Lock indicator : small badge + tooltip “En cours de composition par X — dernière action Y min”.

### Next steps

- Tu fournis : police Aestico (fichier ou nom) + logo (optionnel) + confirmation pour couleur accent si tu veux définir maintenant.
- Après validation : je génère la section complète et on passe à Step 09 (Design Directions).

## Design Direction Decision

### Design Directions Explored

- Direction A — Minimal utilitarian: fond blanc, texte noir, bordures fines, accents très discrets. Priorité à la clarté, vitesse et faible densité d'information.
- Direction B — Branded with accent: fond blanc avec couleur d'accent pour CTAs, ombres légères, cartes arrondies, plus de personnalité.

### Chosen Direction

- Chosen Direction: A — Minimal utilitarian

### Design Rationale

- Priorité au TTC et à la réduction de la charge cognitive pour les utilisateurs en mobilité.
- Permet des décisions rapides (triage en ≤ 3 taps) et une exécution robuste sur PWA mobile-first.
- Facilite l'implémentation rapide et la performance (LCP/INP améliorés) pour le MVP.

### Implementation Approach

- Appliquer tokens existants (background: #FFFFFF, text: #000000, accent placeholder: #0A66C2) et garder une palette restreinte.
- Composants clés stylés sobrement : cartes plates, bordures fines, CTA primaire haute-contraste, secondary muted.
- Tailwind + design tokens pour rapidité d'itération; tokens remplaçables quand Aestico/logo seront fournis.
- Documentation minimale : exemples d'utilisation pour Inbox/Triage, Opportunity Card, Composer modal, Dashboard list.

### Next steps

- Enregistrer cette décision comme base visuelle.
- Générer maquettes détaillées pour les écrans clés (Inbox, Détail Opportunité, Composer, Dashboard) en suivant Direction A.

## User Journey Flows

### Notification → Triage → Action (Mobile)
Description: user receives a notification, opens the app to triage the thread quickly and take an action (attach/create/classify or compose).

```mermaid
flowchart TD
  A[Push notification] --> B[Open Inbox / Deep link to Opportunity]
  B --> C{Is opportunity attached?}
  C -- Yes --> D[Show Opportunity detail (context + last message)]
  C -- No --> E[Show attach / create options]
  E --> F[User selects Attach or Create]
  D --> G{User chooses action}
  G -- Attach/Create/Classify --> H[Quick Triage action applied]
  G -- Compose --> I[Anti-doublon check]
  I -- No conflict --> J[Open Composer (prefill context)]
  I -- Conflict --> K[Show proof modal: Who/When/Draft]
  K --> L{User decision}
  L -- Wait/Inspect --> M[Abort or view draft]
  L -- Force send --> J
  J --> N[Send via Gmail + record trace]
  H --> O[Toast confirmation + realtime update]
  N --> O
```

Success indicators: TTC p95 < 10s, triage ≤ 3 taps, realtime owner/statut update.

---

### Composer / Envoyer sécurisé
Description: compose from opportunity context with anti-duplication protections and trace recording.

```mermaid
flowchart TD
  A[Open Composer from Opportunity] --> B[Prefill context + draft saved]
  B --> C[User composes message]
  C --> D[Pre-send anti-doublon check (server + realtime)]
  D -- OK --> E[Send via Gmail API]
  D -- Conflict --> F[Show conflict modal with proof (who/when/draft)]
  F --> G{User choice}
  G -- View draft --> H[Show draft; allow merge or cancel]
  G -- Force send (confirm) --> E
  E --> I[Record trace (who/when/thread)]
  I --> J[Update opportunity status & notify team]
```

Success indicators: idempotent sends, trace recorded, no duplicate sends.

---

### Dashboard — Assign / Prioritize (Web)
Description: bulk assign and prioritize workflow for owners and exceptions.

```mermaid
flowchart TD
  A[Open Dashboard] --> B[Filter: Sans owner / Proches SLA / Relances dues]
  B --> C[Select items (single or multi-select)]
  C --> D{Action chosen}
  D -- Assign --> E[Assign owner; notify user(s)]
  D -- Schedule relance --> F[Set next action date]
  D -- Change status --> G[Update status]
  E --> H[Realtime propagate to mobile clients]
  F --> H
  G --> H
  H --> I[Dashboard updates; success toast]
```

Success indicators: reduced items without owner, quick bulk actions.

---

### Admin — Connect Gmail & Recovery
Description: admin connects Gmail, verifies sync health and has recovery paths.

```mermaid
flowchart TD
  A[Admin: Connect Gmail] --> B[OAuth flow (Workspace scopes)]
  B --> C[Test sync]
  C -- OK --> D[Sync enabled; show health status]
  C -- Error --> E[Show diagnostic (auth/sync error)]
  E --> F{Choose recovery action}
  F -- Reconnect --> B
  F -- Retry --> C
  F -- View logs --> G[Show simplified logs & support link]
```

Success indicators: p95 ingestion < 30s, easy recovery actions.

---

### Journey Patterns & Optimization Principles

- Entry points: notifications (mobile), inbox, dashboard, deep links.
- Decision patterns: single primary CTA per screen, progressive disclosure for secondary actions.
- Feedback patterns: toast confirmations, realtime updates, visible proof for risky actions.
- Optimization focuses: minimize steps to value, reduce decision fatigue, provide clear recovery paths.


## Component Strategy

### Design System Components

- Foundation components (provided by themeable system / Tailwind + tokens):
  - Buttons (primary / secondary / ghost)
  - Inputs (text, search, autocomplete)
  - Lists, Cards, Modals, Toasts
  - Grid & spacing utilities
  - Typography tokens & utilities
  - Basic forms and validation primitives

### Custom Components (needed for Gigator MVP)

1. Opportunity Card / Thread Preview
   - Purpose: compactly show last message excerpt, venue, status, owner, next action, and quick actions.
   - Content: title, venue badge, last message excerpt, owner avatar, status chip, timestamp.
   - Actions: Open detail, Quick Triage, Take ownership.
   - States: default, selected, muted (old), loading, error.
   - Accessibility: role=listitem, descriptive aria-label; keyboard focus on quick actions.

2. Quick Triage Action Sheet (mobile)
   - Purpose: fast attach/create/classify actions from a compact sheet.
   - Content: primary CTA (Attach/Create/Classify), secondary options (assign, schedule).
   - Actions: attach to venue, create opportunity, classify as irrelevant.
   - States: open/closed, disabled options when offline/error.
   - Accessibility: modal semantics, focus trap, meaningful labels.

3. Composer Modal (context-aware)
   - Purpose: compose replies linked to opportunity with prefilled context and attachments.
   - Content: subject (if needed), body, attachments, send button, save draft.
   - Actions: send (with anti-doublon check), save draft, cancel.
   - States: editing, autosaving, send-in-progress, send-error.
   - Accessibility: form semantics, aria-live for autosave/send feedback.

4. Lock / Proof Indicator + Conflict Modal
   - Purpose: show when someone else is composing or recent send occurred; present proof before risky sends.
   - Content: small badge/proof snippet (who, when, recent action).
   - Actions: view draft, wait, force-send (confirm).
   - Accessibility: clear status text, announced to screen readers.

5. Notification Entry / Deep-link preview
   - Purpose: compact representation for push and in-app notification that deep-links to opportunity.
   - Content: preview text, venue, quick action button.
   - Accessibility: actionable role, keyboard focusable.

6. Dashboard Bulk Action Bar
   - Purpose: multi-select actions (assign, schedule, change status).
   - Content: selection count, action buttons, quick assign input.
   - Accessibility: keyboard operable, clear labels.

### Component Implementation Strategy

- Use design tokens (colors / spacing / radius / type scale) for all styling.
- Build components as small, well-documented primitives (Button, IconButton, Card, ListItem, Modal, Badge).
- Compose custom components from primitives (OpportunityCard = Card + ListItem + Badge + Actions).
- Implementation stack recommendation: React (or Vue) + Tailwind (token-mapped) + Storybook for component docs and examples.
- Accessibility: enforce ARIA patterns, keyboard navigation, and automated contrast checks in CI.
- Testing: visual regression (Chromatic or Percy) for critical components; unit tests for behavior (anti-doublon flows).

### Implementation Roadmap (Prioritized)

Phase 1 — Core Components (0–2 weeks)
- Opportunity Card / Thread Preview
- Quick Triage Action Sheet
- Composer Modal (basic: compose + send + save draft)
- Lock / Proof Indicator + Conflict Modal
- Button, Input primitives

Phase 2 — Supporting Components (2–4 weeks)
- Dashboard List + Bulk Action Bar
- Notification Entry / Deep-link preview
- Toasts / Alerts / Badge variants
- Autocomplete for venue search

Phase 3 — Enhancements (4+ weeks)
- Rich composer features (attachments, templates)
- Advanced bulk actions & filters
- Component theming pipeline, token export, and developer starter kit

### Documentation & Handoff
- Create Storybook with token examples and usage guidelines.
- Add a COMPONENTS.md in `_bmad-output/implementation-artifacts/` summarizing anatomy, states, and examples.
- Provide code-ready token JSON/YAML and Tailwind config snippet.

### Next steps
- Confirm implementation tech preference (React/Vue) and I generate starter Storybook structure and token files.
- On confirmation, I append Component Strategy to the UX spec and proceed to Step 12 when you select C.

## UX Consistency Patterns

### Button Hierarchy

**When to Use:** Primary actions that complete the main task on a screen. Secondary actions for related but non-critical tasks. Tertiary / ghost for low-weight actions.
**Visual Design:** Primary = filled high-contrast (accent on white), Secondary = outline or muted filled, Ghost = text only. Sizes: primary large (44–48px height) on mobile.
**Behavior:** Primary CTA always prominent and single per screen. Secondary actions in footer/overflow. Disable/loading states clear and consistent.
**Accessibility:** Contrast >=4.5:1 for primary text; focus ring visible; aria-labels for icon-only buttons.
**Mobile Considerations:** Touch target ≥44px, spacing around buttons to avoid mis-taps.
**Variants:** Primary / Secondary / Ghost / IconButton / Small

### Feedback Patterns

**When to Use:** After any state-changing action (send, assign, save).
**Visual Design:** Toasts for ephemeral confirmations; inline validation for forms; modals for blocking errors/conflicts.
**Behavior:** Toasts auto-dismiss (3s) with optional action (Undo). Errors surface inline near controls with clear corrective action. Critical conflicts use modal with proof + explicit choices.
**Accessibility:** use aria-live regions for toasts and status updates; error messages linked to inputs (aria-describedby).
**Mobile Considerations:** Keep toasts small, avoid blocking full-screen on mobile; prefer inline messages where possible.
**Variants:** success, info, warning, error

### Form Patterns & Validation

**When to Use:** Data entry (composer, settings, quick assign).
**Visual Design:** Clear labels above fields, helper text for uncommon fields, concise error messages below fields in red.
**Behavior:** Inline validation on blur, summary of errors at top on submit. Autosave drafts where applicable with small status indicator.
**Accessibility:** semantic form elements, label for attribute, aria-invalid on invalid fields, keyboard order logical.
**Mobile Considerations:** Minimize typing, use autocomplete, default suggestions (venues), prefill context when available.
**Variants:** single-line, multi-line, autocomplete, grouped inputs, confirmation dialogs for irreversible actions

### Navigation Patterns

**When to Use:** Global navigation and local context switching.
**Visual Design:** Mobile = bottom bar with 3–5 top-level destinations (Inbox, Directory, Dashboard, Profile). Web = left rail (or top bar) with filters persistent.
**Behavior:** Deep links to specific opportunity from notification. Breadcrumbs optional for deep web flows. Maintain predictable back behavior (history stack).
**Accessibility:** logical DOM order, skip links if needed, focus management on navigation changes.
**Mobile Considerations:** Bottom navigation ergonomics, clear active state, avoid nested navigation >2 levels for core flows.
**Variants:** bottom nav (mobile), side rail (desktop), contextual action bars (selection)

### Modal & Overlay Patterns

**When to Use:** Focused tasks (Composer modal, conflict modal, quick triage).
**Visual Design:** Modals centered, backdrop with subtle darkening; use full-screen modal on small devices for focused flow.
**Behavior:** Focus trap inside modal, escape closes (unless destructive), explicit primary/secondary actions.
**Accessibility:** role="dialog", aria-modal, focus returns to trigger on close.
**Mobile Considerations:** Modal as sheet from bottom for quick actions (Quick Triage), full-screen for composer.

### Empty / Loading States

**When to Use:** No data (no items), initial load, or slow network.
**Visual Design:** Empty states friendly with clear next action (e.g., "Create first opportunity"). Loading skeletons for lists and cards.
**Behavior:** Provide CTA in empty states; retry action for failed loads; skeletons to reduce perceived load time.
**Accessibility:** announce empty state; ensure CTAs keyboard accessible.

### Search & Filtering Patterns

**When to Use:** Inbox, Dashboard filters, Directory search.
**Visual Design:** Persistent search at top of lists; filters collapsible; active filters visible as chips.
**Behavior:** Instant search with debounce, clear affordance to reset filters, saved views for frequent filters (Dashboard).
**Accessibility:** label search input, expose filter state to screen readers.

### Pattern Library Guidelines

- Document each pattern with: When to use / Visual spec / Behavior / Accessibility / Mobile considerations / Code example.
- Prefer single primary action per screen; progressive disclosure for advanced options.
- Reuse primitives from component library to maintain consistency.

### Next steps
- If tu valides, j’append ces patterns au document UX et je passe à l’étape 13 (Responsive & Accessibility).
- Sinon, choisis A (affiner), P (party mode) ou C (continuer) pour la suite.

## Responsive Design & Accessibility

### Responsive Strategy

- Mobile (320–767): 1 colonne, bottom navigation, actions principales visibles (triage + composer), modals full-screen/sheets.
- Tablet (768–1023): mêmes patterns que mobile (1 colonne, touch-first), avec densité légèrement augmentée (listes plus longues, espacements un cran plus serrés).
- Desktop (1024+): 2 panneaux par défaut
  - Panneau gauche: Inbox / Dashboard list + filtres persistants
  - Panneau droit: Détail opportunité (thread + contexte + composer en modal)
  - État par défaut: placeholder “sélectionne un item” côté droit
  - Support: multi-select sur listes côté dashboard (actions bulk)

### Breakpoint Strategy

- Standard:
  - Mobile: 320–767
  - Tablet: 768–1023
  - Desktop: 1024+
- Règles de bascule:
  - ≥1024: activer split view, filtres visibles, densité augmentée
  - <1024: navigation mobile, détail en plein écran

### Accessibility Strategy

- Niveau visé: WCAG AA (recommandé)
- Exigences clés:
  - Contrastes: ≥ 4.5:1 pour texte normal
  - Navigation clavier (web): tab order logique; focus visible; gestion du focus sur changements de vue
  - Screen readers: labels explicites, aria-live pour toasts/états, états lock/conflict annoncés
  - Touch targets: ≥ 44×44px (mobile/tablet)
  - Modals/sheets: focus trap + retour au trigger

### Testing Strategy

- Responsive:
  - iOS Safari + Android Chrome + Desktop Chrome/Edge/Safari
  - Tests réseau réel (perception TTC et comportement loaders/skeletons)
- Accessibilité (strict):
  - axe-core en CI sur écrans clés (Inbox, Détail, Composer, Dashboard)
  - Screen readers: VoiceOver (iOS/macOS) + NVDA (Windows) sur parcours critiques (triage, composer, conflits)
  - Keyboard-only: parcours complet sur dashboard (filtrer, sélectionner, assigner)
  - Simulations: daltonisme + zoom 200% (desktop)

### Implementation Guidelines

- Mobile-first CSS, unités relatives (rem/%), composants fluides.
- Split view desktop:
  - gestion d’état “selected item”
  - deep links (URL) vers opportunité
  - fallback “single pane” si fenêtre étroite
- États réseau:
  - skeletons pour listes
  - retry actionnable
  - erreurs courtes + bouton de récupération (reconnect/retry/save draft)
