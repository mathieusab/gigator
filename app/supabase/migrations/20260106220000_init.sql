-- Barely Blue Booking Manager
-- Initial schema + RLS policies

-- Extensions (safe if already enabled)
create extension if not exists "pgcrypto";

-- Enum for booking pipeline
do $$ begin
  create type concert_status as enum ('contacted', 'negotiating', 'accepted', 'refused');
exception
  when duplicate_object then null;
end $$;

-- app_users: allowlist / authorization
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  is_active boolean not null default false,
  last_login_at timestamptz,
  name text,
  picture text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- concerts
create table if not exists public.concerts (
  id uuid primary key default gen_random_uuid(),
  date_start timestamptz not null,
  date_end timestamptz,
  status concert_status not null default 'contacted',
  venue_name text not null,
  city text,
  country text,
  address text,
  lat double precision,
  lng double precision,
  venue_contact_name text,
  venue_contact_email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ begin
  create trigger trg_app_users_updated_at
  before update on public.app_users
  for each row execute function public.set_updated_at();
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create trigger trg_concerts_updated_at
  before update on public.concerts
  for each row execute function public.set_updated_at();
exception
  when duplicate_object then null;
end $$;

-- RLS
alter table public.app_users enable row level security;
alter table public.concerts enable row level security;

-- Helper predicate: is current JWT email active?
create or replace function public.is_active_app_user()
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.app_users au
    where au.email = (auth.jwt() ->> 'email')
      and au.is_active = true
  );
$$;

-- app_users policies
-- Allow authenticated users to read their own allowlist row
drop policy if exists app_users_select_own on public.app_users;
create policy app_users_select_own
on public.app_users
for select
to authenticated
using (email = (auth.jwt() ->> 'email'));

-- (Optional for later admin UI) Active users can read active users.
-- Kept conservative: only active users can list active users.
drop policy if exists app_users_select_active_if_active on public.app_users;
create policy app_users_select_active_if_active
on public.app_users
for select
to authenticated
using (public.is_active_app_user() and is_active = true);

-- Allow authenticated users to update their own row (e.g., last_login_at)
drop policy if exists app_users_update_own on public.app_users;
create policy app_users_update_own
on public.app_users
for update
to authenticated
using (email = (auth.jwt() ->> 'email'))
with check (email = (auth.jwt() ->> 'email'));

-- concerts policies
drop policy if exists concerts_select_active_users on public.concerts;
create policy concerts_select_active_users
on public.concerts
for select
to authenticated
using (public.is_active_app_user());

drop policy if exists concerts_insert_active_users on public.concerts;
create policy concerts_insert_active_users
on public.concerts
for insert
to authenticated
with check (public.is_active_app_user());

drop policy if exists concerts_update_active_users on public.concerts;
create policy concerts_update_active_users
on public.concerts
for update
to authenticated
using (public.is_active_app_user())
with check (public.is_active_app_user());

drop policy if exists concerts_delete_active_users on public.concerts;
create policy concerts_delete_active_users
on public.concerts
for delete
to authenticated
using (public.is_active_app_user());
