-- Concerts MVP schema

create extension if not exists "pgcrypto";

create table if not exists app_users (
  id uuid primary key,
  email text not null unique,
  is_active boolean not null default true,
  name text,
  picture text,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists concerts (
  id uuid primary key default gen_random_uuid(),
  date_start timestamptz not null,
  date_end timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  venue_name text not null,
  city text,
  country text,
  address text,
  lat numeric,
  lng numeric,
  venue_contact_name text,
  venue_contact_email text,
  notes text,
  created_by uuid not null references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint date_end_after_start check (date_end is null or date_end >= date_start)
);

create index if not exists concerts_date_start_idx on concerts(date_start);

-- If the table already existed from a previous iteration, ensure key columns exist.
-- (CREATE TABLE IF NOT EXISTS does not add new columns.)
alter table concerts add column if not exists date_end timestamptz;
