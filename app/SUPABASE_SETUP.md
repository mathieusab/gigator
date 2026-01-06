# Supabase setup — Barely Blue Booking Manager

## 1) Créer le projet Supabase
- Crée un nouveau projet Supabase.
- Récupère `Project URL` et `anon key`.
- Renseigne-les dans un `.env` local (voir [.env.example](.env.example)).

## 2) Appliquer la migration
- Dans le SQL editor Supabase, exécute le contenu de:
  - [supabase/migrations/20260106220000_init.sql](supabase/migrations/20260106220000_init.sql)

## 3) Préparer les accès
### 3.1 Ajouter les utilisateurs autorisés
- Insère au moins une ligne dans `public.app_users` avec:
  - `email = ton email Google`
  - `is_active = true`

### 3.2 Configurer Supabase Auth (Google)
- Activer provider Google dans Supabase Auth.
- Ajouter les Redirect URLs nécessaires (dev + prod).

## 4) Vérifier
- Lance l’app et ouvre la page Liste.
- L’indicateur Supabase doit passer à “Configuré” quand les env vars sont bien définies.

Notes:
- Les politiques RLS sur `concerts` s’appuient sur l’email dans le JWT (`auth.jwt()->>'email'`).
- Si ton provider Google ne renvoie pas l’email, il faudra ajuster la policy.
