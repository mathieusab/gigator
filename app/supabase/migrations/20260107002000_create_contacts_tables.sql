-- Contacts directory (many-to-many with venues)

-- contacts: reusable directory entries independent from concerts
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  email text,
  phone text,
  last_contact_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at trigger (function is defined in init migration)
do $$ begin
  create trigger trg_contacts_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();
exception
  when duplicate_object then null;
end $$;

create table if not exists public.contact_venues (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  venue_name text not null,
  created_at timestamptz not null default now(),
  unique (contact_id, venue_name)
);

-- RLS
alter table public.contacts enable row level security;
alter table public.contact_venues enable row level security;

-- Policies (same guard as concerts): only active app users

drop policy if exists contacts_select_active_users on public.contacts;
create policy contacts_select_active_users
on public.contacts
for select
to authenticated
using (public.is_active_app_user());

drop policy if exists contacts_insert_active_users on public.contacts;
create policy contacts_insert_active_users
on public.contacts
for insert
to authenticated
with check (public.is_active_app_user());

drop policy if exists contacts_update_active_users on public.contacts;
create policy contacts_update_active_users
on public.contacts
for update
to authenticated
using (public.is_active_app_user())
with check (public.is_active_app_user());

drop policy if exists contacts_delete_active_users on public.contacts;
create policy contacts_delete_active_users
on public.contacts
for delete
to authenticated
using (public.is_active_app_user());

-- contact_venues policies

drop policy if exists contact_venues_select_active_users on public.contact_venues;
create policy contact_venues_select_active_users
on public.contact_venues
for select
to authenticated
using (public.is_active_app_user());

drop policy if exists contact_venues_insert_active_users on public.contact_venues;
create policy contact_venues_insert_active_users
on public.contact_venues
for insert
to authenticated
with check (public.is_active_app_user());

drop policy if exists contact_venues_update_active_users on public.contact_venues;
create policy contact_venues_update_active_users
on public.contact_venues
for update
to authenticated
using (public.is_active_app_user())
with check (public.is_active_app_user());

drop policy if exists contact_venues_delete_active_users on public.contact_venues;
create policy contact_venues_delete_active_users
on public.contact_venues
for delete
to authenticated
using (public.is_active_app_user());

-- Privileges
grant select, insert, update, delete on public.contacts to authenticated;
grant select, insert, update, delete on public.contact_venues to authenticated;

-- Directory view (one row per contact with venues[])
create or replace view public.contacts_directory as
select
  c.id,
  c.full_name,
  c.email,
  c.phone,
  coalesce(c.last_contact_at, c.updated_at) as last_contact_at,
  coalesce(
    array_agg(distinct cv.venue_name order by cv.venue_name) filter (where cv.venue_name is not null),
    '{}'::text[]
  ) as venues
from public.contacts c
left join public.contact_venues cv on cv.contact_id = c.id
group by c.id;

grant select on public.contacts_directory to authenticated;

-- Venue contacts view (one row per (venue, contact)) used by Venues directory
create or replace view public.venue_contacts as
select
  encode(digest(concat_ws('|', cv.venue_name, c.id::text), 'sha256'), 'hex') as id,
  cv.venue_name,
  nullif(trim(c.full_name), '') as venue_contact_name,
  nullif(trim(c.email), '') as venue_contact_email,
  nullif(trim(c.phone), '') as venue_contact_phone,
  coalesce(c.last_contact_at, c.updated_at) as last_contact_at
from public.contact_venues cv
join public.contacts c on c.id = cv.contact_id;

grant select on public.venue_contacts to authenticated;
