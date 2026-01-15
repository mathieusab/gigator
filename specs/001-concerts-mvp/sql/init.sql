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
  date_start timestamptz,
  date_end timestamptz,
  -- Date of the first outbound email sent to the venue/contact (derived from Gmail thread history).
  -- Used for Stats ("concerts contactés par mois").
  first_email_sent_at timestamptz,
  status text not null default 'scheduled' check (status in ('contacted', 'scheduled', 'completed', 'cancelled')),
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
  constraint date_end_after_start check (
    (date_start is null and date_end is null)
    or (date_start is not null and (date_end is null or date_end >= date_start))
  )
);

create index if not exists concerts_date_start_idx on concerts(date_start);
create index if not exists concerts_first_email_sent_at_idx on concerts(first_email_sent_at);

-- Financial items (incomes & expenses) linked to concerts.
-- Amounts are stored in cents to avoid floating point issues.
create table if not exists concert_financial_items (
  id uuid primary key default gen_random_uuid(),
  concert_id uuid not null references concerts(id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  label text not null check (label in ('Cachet', 'Billetterie', 'Merch', 'Parking', 'Transport', 'Hébergement')),
  amount_cents integer not null check (amount_cents >= 0),
  created_by uuid not null references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists concert_financial_items_concert_id_idx on concert_financial_items(concert_id);

-- If the table already existed from a previous iteration, ensure key columns exist.
-- (CREATE TABLE IF NOT EXISTS does not add new columns.)
alter table concerts add column if not exists date_end timestamptz;
alter table concerts add column if not exists first_email_sent_at timestamptz;

-- Allow creating concerts with unknown dates.
alter table concerts alter column date_start drop not null;

-- Update constraint for existing deployments.
alter table concerts drop constraint if exists date_end_after_start;
alter table concerts add constraint date_end_after_start check (
  (date_start is null and date_end is null)
  or (date_start is not null and (date_end is null or date_end >= date_start))
);
