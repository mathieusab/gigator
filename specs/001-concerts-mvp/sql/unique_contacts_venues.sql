-- Ensure contacts & venues uniqueness
--
-- This file is safe to run multiple times.
-- Notes:
-- - If your DB already contains duplicates, creating UNIQUE indexes will fail.
--   In that case, de-duplicate existing rows first (manually or via a one-off script),
--   then re-run this file.

-- Contacts: unique email (case-insensitive) when present
create unique index if not exists contacts_unique_email_idx
  on public.contacts ((lower(trim(email))))
  where email is not null and length(trim(email)) > 0;

-- Contacts: unique phone (normalized digits) when present
create unique index if not exists contacts_unique_phone_digits_idx
  on public.contacts ((regexp_replace(phone, '\\D', '', 'g')))
  where phone is not null and length(trim(phone)) > 0;

-- Venues: unique by (name,address) when address is present
create unique index if not exists venues_unique_name_address_idx
  on public.venues ((lower(trim(name))), (lower(trim(address))))
  where address is not null and length(trim(address)) > 0;

-- Venues: fallback uniqueness by (name,city,country) when address is missing but location is known
create unique index if not exists venues_unique_name_city_country_idx
  on public.venues ((lower(trim(name))), (lower(trim(city))), (lower(trim(country))))
  where (city is not null and length(trim(city)) > 0)
    and (country is not null and length(trim(country)) > 0);

-- In Supabase, this makes PostgREST pick up new indexes.
notify pgrst, 'reload schema';
