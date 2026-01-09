# Design inputs — Wireframes Inbox / Opportunités / Composer / Dashboard

Remplis ce fichier avec les informations demandées. Rédige en français. Pour chaque section, un exemple est fourni pour te guider — supprime ou remplace les exemples par tes données réelles.

---

## 1) Métadonnées du livrable
- Auteur : Mathieu
- Purpose : Wireframes mid-fidelity (desktop + mobile) — Excalidraw (.excalidraw) + PNG + SVG
- Dossier de sortie attendu : {output_folder}

---

## 2) Personas (1 par bloc)
Pour chaque persona, complète les champs suivants.

Persona 1
- Nom : Yeu
- Rôle / titre : Admin
- Contexte / description courte : Créateur du projet, developper, admin
- Objectifs principaux (3 max) : 
  1) Interface claire
  2) Navigation intuitive
  3) Style simple et efficace
- Frustrations / douleurs (3 max) :
  1) Erreurs
  2) Lenteurs
  3) Navigation complexe
- Priorité d’utilisation de l’app (High / Medium / Low): High

Persona 2
- Nom : Thomas
- Rôle / titre : Utilisateur simple
- Contexte / description courte : Membre du groupe qui effectue principalement des recherches
- Objectifs principaux (3 max) : 
  1) Pouvoir ajouter des opportunités
  2) Navigation intuitive
- Frustrations / douleurs (3 max) :
  1) Navigation complexe
- Priorité d’utilisation de l’app (High / Medium / Low): Medium

Persona 3
- Nom : DeeDee
- Rôle / titre : Utilisateur simple
- Contexte / description courte : Membre du groupe qui contacte beaucoup les gérants de salle
- Objectifs principaux (3 max) : 
  1) Pouvoir ajouter des opportunités
  2) Pouvoir modifier des opportunités
  3) Répondre / voir les mails reçus
- Frustrations / douleurs (3 max) :
  1) Navigation complexe
  2) Erreurs
- Priorité d’utilisation de l’app (High / Medium / Low): High

Persona 4
- Nom : Matt
- Rôle / titre : Utilisateur simple
- Contexte / description courte : Membre du groupe peu actif qui se connecte de temps en temps
- Objectifs principaux (3 max) : 
  1) Voir clairement l'état des opportunités
  2) Pouvoir modifier des opportunités
  3) Voir les mails reçus
- Frustrations / douleurs (3 max) :
  1) Navigation complexe
  2) Erreurs
- Priorité d’utilisation de l’app (High / Medium / Low): Low

---

## 3) Tâches clés par écran (liste d'actions / jobs-to-be-done)
Décris les tâches que l'utilisateur doit accomplir sur chaque écran.

Inbox / Triage
- Tâche 1 : Classer le mail avec un label
- Tâche 2 : Assigner à une salle
- Tâche 3 : Cacher un mail qui n'est pas une opportunité de concert

Détail Opportunité
- Tâche 1 : Ajouter un maximum d'information sur le concert
- Tâche 2 : Lier à un ou plusieurs contacts
- Tâche 3 : Voir sur une carte intéractive le lieu du concert

Composer (rédaction / réponse)
- Tâche 1 : Rédiger avec assistance d'une IA
- Tâche 2 : Mettre le message en revue pour validation par une autre personne (si demandé par l'auteur)
- Tâche 3 : Voir l'historique de la conversation

Dashboard
- Tâche 1 : Voir sur une carte intéractive les prochains concerts 
- Tâche 2 : Voir sur un calendrier les prochains concerts
- Tâche 3 : Avoir des statistiques sur le nombre d'opportunités selon l'état
- Tâche 4 : Voir un historique des dernières actions effectuées par les membres du groupe

---

## 4) Palette / Branding
Fournis les couleurs hex et indications d'usage.

- Fond : #FFFFFF
- Texte : #000000
- Bordures : #000000
- Primaire (CTA) : #000000 (monochrome)
- Neutres complémentaires : (optionnel) #F5F5F5 (bg secondaire), #999999 (texte secondaire)

- Police(s) recommandée(s) / tailles : Aestico (Demo)
- Autres contraintes visuelles (bordures, radius, icônes) :
  - Icônes unifiées, simples, noires sur fond blanc
  - Boutons : bordure noire, fond blanc, texte noir (CTA éventuellement fond noir + texte blanc)
  - Petit radius sur les angles des boutons

---

## 5) Dataset — 6 exemples d’opportunités / messages
Remplis la table ci‑dessous avec 6 exemples réels ou fictifs. Chaque ligne = une opportunité / message.

| # | Titre | Statut | Date | Contact(s) | Salle (assignée) |
|---|-------|--------|------|------------|------------------|
| 1 | Truskel | Concert joué | 12/12/2025 | Jean Michel | Truskel |
| 2 | Mécanique Ondulatoire | Échange d'information | - | Jessica | Mécanique Ondulatoire |
| 3 | Olympic Café | Premier contact | - | Philippe Halliday | Olympic Café |
| 4 | Le Chinois | Refusé | - | Donald Arthur | Le Chinois |
| 5 | La Java | Concert planifié | 03/04/2026 | Jacques Arbre | La Java |
| 6 | Le Klub | Échange d'information | - | Michel Edouard | Le Klub |

Statuts : Concert joué / Échange d'information / À relancer / Premier contact / Concert planifié / Refusé / Pas de réponse

---

## 5b) Annuaire de contacts (requis)
Ces informations doivent être **liées à l’évènement / opportunité** (tout n’a pas besoin d’être visible partout) :
- Téléphone
- Email
- Adresse de l’évènement
- Moyen de contact préféré
- Possibilité d’assigner des contacts à une salle (et/ou à une opportunité)

Table contacts (exemples à compléter) :

| # | Nom | Email | Téléphone | Moyen de contact préféré | Salle(s) associée(s) | Notes |
|---|-----|-------|-----------|--------------------------|----------------------|-------|
| 1 | Jean Michel |  |  |  | Truskel |  |
| 2 | Jessica |  |  |  | Mécanique Ondulatoire |  |
| 3 | Philippe Halliday |  |  |  | Olympic Café |  |
| 4 | Donald Arthur |  |  |  | Le Chinois |  |
| 5 | Jacques Arbre |  |  |  | La Java |  |
| 6 | Michel Edouard |  |  |  | Le Klub |  |

---

## 6) KPIs prioritaires pour le Dashboard (3)
Indique les 3 KPIs à afficher en priorité, format d'affichage souhaité (nombre, pourcentage, sparkline).

1) Opportunités ouvertes : 42 (nombre)
2) Conversion semaine : 7.5% (pourcentage + trend)
3) Temps moyen de réponse : 3h 24m (durée)
4) Opportunités par catégorie : Camembert

---

## 7) Contraintes & Accessibilité
- Devices prioritaires : Mobile responsive + Desktop
- Breakpoints / largeur cible desktop (px) : 1200px
- Niveau d'accessibilité souhaité (AA / AAA) : AA
- Microcopy obligatoire (ex: footer légal, texte de consentement) : Non
- Limitations techniques (ex: pas d'images externes, chargement limité) : Chargement rapide (moins de 3s)

---

## 8) Notes supplémentaires / Workflows spéciaux
Décris ici tout workflow particulier, automation, micro-interactions, ou cas d’usage complexe :
bulk actions

---

## 9) Validation & livraison
- Format livrable attendu : `.excalidraw`, `.png`, `.svg`
- Dossier de livraison : {output_folder}

---


