# Supabase setup — Barely Blue Booking Manager

## 1) Créer le projet Supabase
- Crée un nouveau projet Supabase.
- Récupère `Project URL` et `anon key`.
- Renseigne-les dans un `.env` local (voir [.env.example](.env.example)).

## 2) Appliquer la migration
- Dans le SQL editor Supabase, exécute le contenu des migrations **dans l'ordre**:
  - [supabase/migrations/20260106220000_init.sql](supabase/migrations/20260106220000_init.sql)
  - [supabase/migrations/20260106233000_add_concert_title.sql](supabase/migrations/20260106233000_add_concert_title.sql)
  - [supabase/migrations/20260106235500_make_concert_date_optional.sql](supabase/migrations/20260106235500_make_concert_date_optional.sql)
  - [supabase/migrations/20260107000030_add_concert_contact.sql](supabase/migrations/20260107000030_add_concert_contact.sql)
  - [supabase/migrations/20260107000500_add_contact_phone.sql](supabase/migrations/20260107000500_add_contact_phone.sql)
  - [supabase/migrations/20260107001500_create_venue_contacts_view.sql](supabase/migrations/20260107001500_create_venue_contacts_view.sql)
  - [supabase/migrations/20260107002000_create_contacts_tables.sql](supabase/migrations/20260107002000_create_contacts_tables.sql)

Notes:
- Si tu vois une erreur du type "Could not find the table 'public.xxx' in the schema cache", c'est souvent que la table/vue n'a pas été créée dans le projet, ou que PostgREST n'a pas encore rechargé son schéma.
- Tu peux forcer le reload dans le SQL editor avec:
  - `select pg_notify('pgrst', 'reload schema');`

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
