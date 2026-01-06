# Prompt d’implémentation (IA) — Barely Blue Booking Manager

Tu es une IA développeur senior. Implémente l’application décrite dans [PRD.md](PRD.md) en respectant **la même stack et le même thème que le projet Validator**.

## Contraintes non négociables
- Stack: **React + TypeScript + Vite**, **react-router-dom**, **Tailwind CSS** (darkMode class + CSS variables), `tailwindcss-animate`, `lucide-react`, `@supabase/supabase-js`, PWA via `vite-plugin-pwa`.
- Auth: **Google OAuth via Supabase Auth**, récupération du `session.provider_token` pour appeler Gmail.
- Données: **Supabase** (tables + RLS).
- Features MVP: Auth Google, Supabase, Gmail (historique par contact), Liste, Calendrier, Carte (Google Maps), mobile friendly, PWA.
- Ne pas inventer d’écrans/features non demandés (pas de CRM avancé, pas de push notif).

## Sorties attendues
- Code complet runnable localement.
- `.env.example` cohérent.
- Migrations SQL Supabase (ou scripts) + politiques RLS.
- README minimal: setup + commandes.

---

## Tâches (à exécuter dans l’ordre)

### 1) Bootstrap du projet
1. Créer une app Vite React TS.
2. Installer deps:
   - runtime: `react`, `react-dom`, `react-router-dom`, `@supabase/supabase-js`, `date-fns`, `clsx`, `tailwind-merge`, `lucide-react`
   - UI: `tailwindcss`, `postcss`, `autoprefixer`, `tailwindcss-animate`
   - PWA: `vite-plugin-pwa`
3. Configurer Tailwind **comme Validator**:
   - `darkMode: ["class"]`
   - tokens couleurs via CSS variables (`--background`, `--primary`, etc.)
   - `tailwindcss-animate`
4. Ajouter base CSS (variables + typographie) en s’inspirant de Validator.

**Done quand**: `npm run dev` démarre sans erreurs et affiche une page vide stylée.

### 2) Routing & layout
1. Mettre en place `react-router-dom` avec routes MVP:
   - `/concerts` (liste)
   - `/calendar` (calendrier)
   - `/map` (carte)
   - `/concerts/:id` (fiche concert)
2. Ajouter un layout commun + navigation (simple) cohérente avec Validator.
3. Assurer responsive mobile (nav utilisable au doigt).

**Done quand**: navigation entre pages OK (desktop + mobile).

### 3) Supabase — config & client
1. Ajouter `.env.example`:
   - `VITE_SUPABASE_URL=`
   - `VITE_SUPABASE_ANON_KEY=`
   - `VITE_GOOGLE_API_KEY=` (si nécessaire pour Maps/gapi)
   - `VITE_GOOGLE_CLIENT_ID=` (si nécessaire)
2. Implémenter `supabaseClient.ts` (pattern Validator: `createClient` + `detectSessionInUrl`).

**Done quand**: l’app charge sans Supabase (mode dégradé) et avec Supabase (si vars set).

### 4) Supabase — schéma & RLS
1. Créer migrations SQL (ou doc de setup) pour:
   - table `app_users` (email unique, is_active, last_login_at, name, picture)
   - table `concerts`:
     - `date_start`, `date_end`
     - `status` ∈ `contacted | negotiating | accepted | refused`
     - `venue_name`, `city`, `country`, `address`, `lat`, `lng`
     - `venue_contact_name`, `venue_contact_email`, `notes`
2. Activer RLS sur les tables.
3. Politiques:
   - seuls les utilisateurs **autorisés** (`app_users.is_active=true`) peuvent lire/écrire `concerts`.
   - `app_users` lisible au minimum pour l’autorisation (pattern Validator).

**Done quand**: un user actif peut CRUD concerts, un user inactif ne peut rien lire/écrire.

### 5) Auth — Supabase Google OAuth + autorisation
1. Créer un `SupabaseAuthContext` comme Validator:
   - charge session
   - `signInWithGoogle()` via `supabase.auth.signInWithOAuth({ provider: 'google', options: { scopes, ... } })`
   - vérifie l’autorisation via `app_users`
   - met à jour `last_login_at`
2. Créer une UI login/logout + état loading.
3. Bloquer l’app si `isAuthorized=false` (page “access denied”).

**Done quand**: login Google fonctionne, et l’accès est conditionné à `app_users`.

### 6) Google scopes — inclure Gmail
1. Définir les scopes Google requis:
   - `userinfo.profile`, `userinfo.email`
   - **Gmail readonly**: `https://www.googleapis.com/auth/gmail.readonly`
   - (optionnel) scopes Maps si besoin distinct.
2. Vérifier que Supabase renvoie bien `provider_token` après login.

**Done quand**: `session.provider_token` est disponible après login.

### 7) CRUD Concerts — saisie manuelle
1. Implémenter services Supabase:
   - `listConcerts()` (tri)
   - `getConcertById(id)`
   - `createConcert()`
   - `updateConcert(id)`
2. Écran Liste:
   - sections “À venir” / “Passés”
   - affiche statut + venue + date
3. Écran Fiche concert:
   - formulaire éditable (date, lieu, statut, contact name/email, notes)
   - validation minimale (date_start + venue_name)

**Done quand**: on peut créer/éditer un concert et il apparaît dans Liste.

### 8) Calendrier (comme Validator)
1. Créer page Calendrier affichant **tous** les concerts.
2. Interaction minimale:
   - navigation par mois
   - clic sur événement → va vers `/concerts/:id`
3. Rendu mobile: lisible; si trop d’événements sur une journée, afficher un indicateur et ouvrir le détail.

**Done quand**: page calendrier utilisable sur mobile/desktop.

### 9) Carte Google Maps
1. Ajouter page Carte.
2. Afficher pins pour concerts ayant `lat/lng`.
3. Clic pin → aperçu (venue + date).
4. (Option MVP) Si `lat/lng` absent, afficher le concert sans pin (ou ignorer), sans crash.

**Done quand**: la carte s’affiche et les pins fonctionnent.

### 10) Gmail — historique de conversation par contact
1. Ajouter dans la fiche concert un bouton “Voir la conversation Gmail”.
2. Implémenter un client Gmail (fetch REST) utilisant `provider_token`:
   - appeler `users.threads.list` avec `q=(from:contactEmail OR to:contactEmail)`
   - puis `users.threads.get` pour afficher le contenu.
3. UI minimale:
   - liste de threads
   - thread detail: sujet + messages (snippet ou extrait), date.
4. Gestion d’erreurs:
   - pas de `venue_contact_email` → message clair
   - token manquant/expiré → relogin

**Done quand**: depuis un concert avec contactEmail, on voit des threads Gmail.

### 11) Mobile-first hardening
1. Vérifier toutes vues en largeur 375px.
2. Ajuster tailles de boutons/cibles tactiles.
3. S’assurer que la carte est manipulable au doigt sans overlay gênant.

**Done quand**: utilisable sans zoom (critères PRD).

### 12) PWA
1. Configurer `vite-plugin-pwa`:
   - manifest (name/short_name/icons/theme_color)
   - service worker cache minimal des assets.
2. Ajouter une page/état “hors connexion” simple (sans offline data).

**Done quand**: installation possible (A2HS) et lancement depuis l’icône OK.

### 13) Qualité & docs
1. Ajouter `README.md` (setup env, Supabase setup, run dev/build).
2. Vérifier `npm run lint` (si ajouté) et `npm run build`.

**Done quand**: build OK et doc suffisante pour un autre membre du groupe.

---

## Notes de sécurité
- Ne jamais stocker le `provider_token` en clair en base.
- Restreindre les API keys Google (HTTP referrers, domaines) et minimiser les scopes.

## Livraison
- Ouvrir une PR avec:
  - description des features
  - checklist (Auth, Supabase RLS, Liste, Calendrier, Carte, Gmail, PWA, Mobile)
