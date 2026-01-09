---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/research/technical-integration-gmail-api-boite-mail-partagee-auth-scopes-sync-threads-pieces-jointes-audit-trail-research-2026-01-07.md
date: 2026-01-07T18:32:57Z
author: Mathieu
---





# Product Brief: gigator

<!-- Content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

Gigator vise à centraliser le suivi du pipeline de booking et la collaboration d’une équipe aujourd’hui dispersée entre Gmail, Google Docs et Google Sheets. Le problème n’est pas “juste” l’organisation : c’est la perte de responsabilité et de visibilité qui fait que certains emails restent des semaines sans traitement, tandis que le fichier de suivi grossit (200+ emails envoyés) et finit par ne plus refléter la réalité. Gigator apporte un suivi clair et un flux de travail partagé pour que tout le monde participe, que les réponses soient traitées, et que l’état du pipeline soit fiable.

---

## Core Vision

### Problem Statement

L’équipe de booking travaille avec trop d’outils hétérogènes (Gmail, GDoc, GSheet), ce qui fragmente l’information et dilue la responsabilité : des échanges importants ne sont pas pris en charge et le pipeline devient difficile à piloter.

### Problem Impact

- Des emails critiques restent sans réponse/traitement pendant des jours ou des semaines.
- Le suivi devient lourd (fichier très volumineux) et perd en fiabilité (lignes non à jour).
- La participation de l’équipe baisse car personne n’a une vue simple et partagée de “ce qui doit être fait maintenant”.

### Why Existing Solutions Fall Short

- Gmail est bon pour communiquer, mais pas pour structurer un pipeline partagé ni rendre l’ownership explicite.
- Un Google Sheet/Doc peut servir de registre, mais se désynchronise vite de la réalité des échanges et devient coûteux à maintenir à jour.
- L’information est dispersée : l’équipe n’a pas un “single source of truth” simple, lisible, et actionnable.

### Proposed Solution

Gigator centralise le pipeline de booking (par salle/lieu) et fournit un suivi clair et partagé du statut de chaque contact/conversation, avec des mécanismes qui encouragent la prise en charge et la mise à jour continue. L’objectif est que l’équipe sache immédiatement : qui s’en occupe, où on en est, et quelle est la prochaine action.

### Key Differentiators

- Vue pipeline claire et unifiée (au lieu d’un patchwork Gmail + docs + sheet).
- Collaboration orientée “action” : on voit ce qui est en attente, ce qui bloque, et ce qui a besoin d’un owner.
- Fiabilité du suivi : le système est conçu pour éviter que l’info reste “dans une boîte mail” ou que le fichier de suivi diverge de la réalité.

## Target Users

### Primary Users

#### Persona 1 — “Membre du groupe / Booker polyvalent”

**Nom & contexte**
- *Camille*, membre du groupe (équipe interne de 4). Pas un “poste” dédié : chacun contribue au booking.
- Contexte : travaille avec un mix d’outils (Gmail + docs/sheets) et une liste d’opportunités qui grossit vite.

**Objectifs & motivations**
- Aider à remplir le pipeline de concerts.
- Envoyer des emails de qualité (et éviter les erreurs), relancer au bon moment.
- Garder la liste d’opportunités à jour sans y passer ses soirées.

**Expérience du problème aujourd’hui**
- Doit jongler entre lecture de mails, envoi, recherche de nouveaux concerts, puis mise à jour manuelle de la liste.
- Risque de “trous noirs” : certains mails restent non traités car pas d’ownership clair et info dispersée.
- La liste devient lourde et finit par diverger de la réalité (statuts pas à jour).

**Vision du succès**
- Plus d’emails oubliés : tout mail/opportunité a un statut clair et une prochaine action.
- Une vue simple pour savoir : “qu’est-ce que je dois faire aujourd’hui ?”
- Collaboration fluide : chacun voit où en est le pipeline sans se marcher dessus.

#### Persona 2 — “Admin / Power User (gestion outils + contributeur)”

**Nom & contexte**
- *Mathieu*, admin interne. Fait le même travail de booking que les autres (lire/envoyer/chercher/ajouter), mais en plus il configure et maintient les outils.

**Objectifs & motivations**
- Réduire la friction et l’entropie opérationnelle (trop d’outils).
- Garantir la fiabilité du pipeline (éviter le sheet “pas à jour”).
- Augmenter la participation de tout le monde (chacun contribue, pas seulement 1 personne).

**Expérience du problème aujourd’hui**
- Charge mentale forte : si le système est fragile, l’admin devient “filet de sécurité” implicite.
- Doit souvent vérifier / relire / recadrer le suivi pour éviter les erreurs ou les oublis.

**Vision du succès**
- Un système unique, clair, avec des règles simples (ownership, statuts, relances) qui s’auto-maintient.
- Adoption : la participation augmente naturellement parce que c’est plus simple que Gmail+docs+sheet.

### Secondary Users

N/A (outil à usage interne uniquement, pas d’utilisateurs externes identifiés à ce stade).

### User Journey

**Discovery**
- Adoption interne : l’équipe décide de centraliser car trop d’outils et trop d’emails non traités.

**Onboarding**
- L’admin met en place l’outil (accès, configuration, éventuellement connexion Gmail / import de la liste existante).
- Les membres voient une vue claire des opportunités et comprennent les statuts / prochaines actions.

**Core Usage (quotidien / hebdo)**
- Lire et traiter les nouveaux messages/opportunités.
- Envoyer des emails et planifier/faire des relances.
- Chercher de nouveaux concerts et ajouter les opportunités dans la liste.
- Mettre à jour le statut à chaque nouvelle info (pour éviter la divergence avec la réalité).

**Success Moment (“aha!”)**
- L’équipe réalise que plus rien ne “dort” : chaque opportunité a un état, une prochaine action, et on sait ce qui est en attente.
- La liste reste fiable sans effort héroïque.

**Long-term**
- Le pipeline devient un réflexe d’équipe : contribution partagée, visibilité partagée, moins de friction et de pertes.

## Success Metrics

### User Success Metrics (qualité d’exécution)

**Anti-oubli / réactivité**
- 3 mois:
  - 90% des nouveaux mails/opportunités ont une “première action” (assigné / répondu / à relancer) en < 48h
  - ≤ 5 mails/opportunités > 7 jours sans action (stock total)
- 12 mois:
  - 95% en < 24h
  - ≤ 1 mail/opportunité > 7 jours sans action

**Fiabilité du pipeline**
- 3 mois:
  - 90% des opportunités ont un statut mis à jour dans les 7 derniers jours
  - ≤ 5% d’opportunités “sans owner”
- 12 mois:
  - 95% mis à jour dans les 7 jours
  - ≤ 2% sans owner

**Participation (outil interne, 5 utilisateurs)**
- 3 mois:
  - 80% des utilisateurs actifs chaque semaine
  - Participation minimale: ≥ 1 action / semaine / personne (ex: assigner, répondre, relancer, créer/maj opportunité)
- 12 mois:
  - 90% actifs / semaine
  - ≥ 2 actions / semaine / personne

**Relecture (qualité avant envoi)**
- 3 mois:
  - 80% des emails passent de “brouillon prêt” → “validé + envoyé” en < 24h
- 12 mois:
  - 90% en < 12h

---

### Business Objectives

**Taux de réponse**
- 3 mois: +15% (vs baseline actuel)
- 12 mois: +30%

**Concerts bookés**
- 3 mois: +10% de concerts bookés (vs baseline)
- 12 mois: +25%

**Temps passé sur le suivi (Gmail + doc + sheet)**
- 3 mois: -2h / semaine (temps d’admin + temps de coordination)
- 12 mois: -4h / semaine

---

### Key Performance Indicators

- Response Rate (% réponses / emails envoyés), par semaine et cumul
- Bookings Won (# concerts confirmés / mois)
- Time Spent (heures / semaine sur suivi + coordination)
- “Time to First Action” (p90 / p95 en heures)
- “Dormant Items” (# opportunités > 7 jours sans action)
- Data Freshness (% opportunités mises à jour dans les 7 jours)
- Ownership Coverage (% opportunités avec owner)
- Weekly Active Users (WAU / 5)
- Participation Rate (% utilisateurs avec ≥ 1 action / semaine)

## MVP Scope

### Core Features

- Pipeline centralisé des opportunités (par salle/lieu) : liste unique et partagée (source de vérité)
- Ownership : chaque opportunité/conversation a un owner explicite
- Statuts simples et actionnables (ex: à contacter / contacté / en attente / à relancer / confirmé / perdu)
- Relance : suivi des relances (prochaine action / date de relance) pour éviter les mails oubliés
- App mobile : exécution “terrain” (consultation rapide, mise à jour statut, assignation/prise en charge, relances)

### Out of Scope for MVP

- Mode multi-équipes / multi-organisations (l’outil reste usage interne pour l’équipe actuelle)

### MVP Success Criteria

- 100% des emails/opportunités sont traités en moins de 7 jours (pas de conversation qui “dort”)
- 0 opportunité sans owner au-delà de 48h après création/réception (évite la dilution de responsabilité)

### Future Vision

- IA de suggestion (ex: proposer statut, owner, prochaine action)
- IA de rédaction : brouillons de mails de réponse et relances assistées
- Relance intelligente via IA (timing, contenu, priorisation)
