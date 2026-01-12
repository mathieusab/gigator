# PRD — Barely Blue · Gigator

## 1) Résumé
Barely Blue joue des concerts dans plusieurs salles. L’objectif est de construire une application interne (web) pour centraliser le suivi des dates (passées / à venir), des échanges email avec les salles et de la localisation des concerts sur carte.

Ce PRD s’aligne sur la stack et les patterns observés dans le projet GitHub **Validator** (mathieusab/validator) :
- Frontend: **React + TypeScript + Vite**
- Routing: **react-router-dom**
- UI/Theme: **Tailwind CSS** (darkMode class), design basé sur **CSS variables** (`--primary`, `--background`, etc.), + **tailwindcss-animate**, icônes **lucide-react**
- Auth & data: **Supabase** via `@supabase/supabase-js`
- OAuth Google: via **Supabase Auth (provider=google)** en récupérant le **`provider_token`** côté client pour appeler des APIs Google
- Distribution: **PWA** (installable) via Vite (même approche que Validator avec `vite-plugin-pwa`)

## 2) Problème
Aujourd’hui, le booking se fait via des échanges dispersés (emails, messages, notes) :
- difficile de savoir quelles salles ont été contactées, relancées, confirmées
- pas de vue claire des dates à venir vs passées
- pas de représentation géographique (tournées, clusters, distances)
- risque d’oublis (relances, confirmations, infos pratiques)

## 3) Objectifs
### Objectifs produit
- Centraliser les concerts (dates + infos salle) dans une source unique.
- Accéder aux emails du groupe (Gmail) pour suivre les conversations liées au booking.
- Visualiser les concerts sur une carte interactive.

### Objectifs business / opérationnels
- Réduire le temps passé à retrouver des infos.
- Diminuer les erreurs de coordination (double booking, oublis de relance).

## 4) Utilisateurs & accès
### Utilisateurs cibles
- Membres de Barely Blue impliqués dans le booking.

### Contrôle d’accès (aligné sur Validator)
- Authentification via Google.
- Autorisation applicative via une table Supabase (type `app_users`) permettant d’activer/désactiver l’accès par email.

## 5) Périmètre (MVP)
Fonctionnalités demandées (MVP) :
1. **Connexion Google** pour l’authentification.
2. **Connexion Supabase** pour stockage (concerts + metadata).
3. **Connexion Gmail** pour accès aux emails du groupe.
4. **Liste** des concerts passés et à venir.
5. **Carte interactive Google Maps** affichant les concerts.
6. **Calendrier** (comme dans Validator) pour visualiser les concerts à l’avance.

Décisions (confirmées) :
- **Source des concerts: saisie manuelle**.
- **Pipeline booking détaillé** (cf. statuts).
- **Gmail: lecture de l’historique de conversation par contact (gérant de salle)**.

## 6) Hors périmètre (pour éviter de dériver)
- Paiements / facturation

## 7) Parcours utilisateur (UX)
> Note: l’UX doit rester simple et proche du style Validator (Tailwind + tokens via CSS variables). Pas d’ajout de features “nice-to-have” non demandées. Validator et Gigator sont deux applications de la même suite d'application. Le thème doit être le même que Validator. 

### 7.1 Connexion
- Bouton “Sign in with Google”.
- Après login: affichage de l’identité (avatar + email) + possibilité de logout.

### 7.2 Vue Liste (concerts)
- Deux sections:
  - “À venir” (ordre chronologique)
  - “Passés” (ordre antichronologique)
- Chaque concert affiche au minimum:
  - Date / heure
  - Nom de la salle / ville
  - Statut (pipeline booking détaillé)

Source des données: **saisie manuelle** (création/édition d’un concert dans l’app).

### 7.3 Vue Calendrier
- Vue calendrier (même logique que dans Validator) pour voir rapidement les dates à venir.
- Affiche **tous** les concerts (quel que soit le statut) comme des événements, avec au minimum: `venue_name` + statut.
- Interactions minimales:
  - navigation par mois
  - clic sur un événement → ouvre la fiche concert (ou un aperçu minimal)

### 7.4 Vue Carte
- Google Maps avec pins pour chaque concert.
- Interactions minimales:
  - clic pin → affiche un aperçu (nom salle + date)

### 7.5 Accès Gmail
- Après connexion, l’app peut **interroger l’API Gmail** afin de récupérer l’historique de conversation avec un contact (ex: gérant de salle).
- Le flux MVP attendu:
  - depuis une fiche concert (ou depuis une salle), l’utilisateur indique/voit l’email du contact
  - l’app affiche la liste des messages/threads Gmail pertinents (lecture seule)

Remarque: on ne vise pas une “boîte mail” générale; uniquement un accès ciblé “conversation avec X”.

## 8) Données (Supabase)
### 8.1 Tables minimales
#### `concerts`
- `id` (uuid, PK)
- `date_start` (timestamptz, required)
- `date_end` (timestamptz, optional)
- `status` (text/enum, required) — pipeline:
  - `contacted`
  - `negotiating`
  - `accepted`
  - `refused`
- `venue_name` (text, required)
- `city` (text, optional)
- `country` (text, optional)
- `address` (text, optional)
- `lat` (double precision, optional)
- `lng` (double precision, optional)
- `venue_contact_name` (text, optional)
- `venue_contact_email` (text, optional) — clé pour la requête Gmail
- `notes` (text, optional)
- `created_at`, `updated_at`

#### `app_users` (pattern Validator)
- `email` (text, unique)
- `is_active` (bool)
- `last_login_at` (timestamptz)
- `name`, `picture` (optional)

### 8.2 RLS & sécurité
- Activer RLS sur toutes les tables.
- Restreindre `concerts` aux utilisateurs autorisés (`app_users.is_active = true`).

## 9) Intégrations

### 9.1 Google OAuth (auth)
- Implémentation recommandée (comme Validator):
  - Auth via `supabase.auth.signInWithOAuth({ provider: 'google', options: { scopes, ... }})`
  - Utilisation du **`session.provider_token`** pour appeler ensuite les APIs Google.

### 9.2 Gmail
- Scope recommandé (MVP, lecture seule):
  - `https://www.googleapis.com/auth/gmail.readonly`
- APIs visées (indicatif):
  - `users.threads.list` (filtrer par requête Gmail `q`)
  - `users.threads.get` (récupérer le contenu d’un thread)

Approche MVP (sans backend):
- Appel direct à Gmail depuis le client en utilisant le **`provider_token`** Supabase (OAuth Google).
- Requête de type: `q=(from:contact@email OR to:contact@email)` pour retrouver les conversations.

Évolutions possibles (hors MVP): historiser côté Supabase, sync périodique, ou envoi d’emails (scopes plus permissifs).

### 9.3 Supabase
- Utiliser `@supabase/supabase-js` côté client (pattern Validator).
- Variables d’env attendues (pattern Validator):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

### 9.4 Google Maps
- Google Maps JavaScript API (ou alternative légère selon la stack), avec une API key dédiée.
- Selon besoins: Geocoding API pour convertir une adresse en lat/lng (si tu veux que l’app le fasse automatiquement).

## 10) Exigences non-fonctionnelles
- Sécurité: ne jamais exposer de secrets côté client (API keys Google ok si restrictions strictes; tokens OAuth via Supabase session seulement).
- Conformité: accès Gmail = données personnelles → minimiser, ne stocker que ce qui est nécessaire.
- Performance: liste et carte doivent rester fluides pour un volume réaliste (ex: quelques centaines de concerts).

### Compatibilité mobile
- L’application doit être **responsive** et utilisable sur mobile (iOS/Android) via navigateur moderne.
- Contraintes UX mobile:
  - navigation et actions utilisables au doigt (cibles tactiles suffisantes)
  - mise en page adaptée petits écrans pour les vues **Liste**, **Calendrier**, **Carte**
  - carte: zoom/déplacement tactiles sans gêne (pas d’overlays bloquants)
  - calendrier: lisible en vue mensuelle; si densité trop forte sur un jour, afficher un indicateur et permettre d’ouvrir le détail.
- Contraintes techniques:
  - éviter de bloquer l’authentification sur le chargement de scripts externes (pattern déjà utilisé dans Validator pour gapi)
  - temps de chargement acceptable en 4G; limiter les bundles inutiles et le nombre de requêtes au démarrage

Critères d’acceptation (MVP):
- Les flows de connexion Google/Supabase fonctionnent sur mobile.
- Les 3 vues principales (Liste/Calendrier/Carte) sont utilisables sans zoomer la page.

### PWA
- L’application doit être une **Progressive Web App** (installable) pour améliorer l’expérience mobile.
- Implémentation attendue (alignée Validator):
  - `vite-plugin-pwa` (manifest + service worker)
  - icônes + nom court/long + couleur de thème
  - cache minimal des assets statiques (shell de l’app)
- Offline: **non requis** pour les données (concerts/emails), mais l’app doit au minimum afficher une page “hors connexion” propre si nécessaire.
- Hors périmètre PWA: push notifications.

Critères d’acceptation (MVP):
- Le navigateur propose l’installation ("Add to Home Screen") sur mobile compatible.
- L’app lancée depuis l’icône fonctionne et charge l’UI (assets servis via cache) même avec réseau instable.

## 11) Mesures de succès (KPIs)
- % de concerts renseignés avec lieu + date.
- Temps moyen pour retrouver une info de booking (qualitatif, via feedback).
- Nombre d’utilisateurs actifs / mois (membres).

## 12) Jalons (proposition)
1. Setup projet (copie de la stack Validator) + Supabase + Auth Google.
2. Modèle `concerts` + CRUD minimal + liste “passés/à venir” + **vue calendrier**.
3. Google Maps: affichage des concerts géolocalisés.
4. Gmail: connexion + lecture (historique par contact).

## 13) Questions (pour finaliser le PRD)
Décisions validées:
- **Gmail**: accès ciblé pour récupérer l’historique de conversation avec un contact (gérant de salle).
- **Concerts**: saisie manuelle.
- **Statuts**: pipeline détaillé (`contacted`, `negotiating`, `accepted`, `refused`).
