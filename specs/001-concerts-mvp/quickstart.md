# Quickstart — Concerts MVP

## Prerequisites
- Node.js 18+
- pnpm or npm
- Supabase project (URL + anon key)
- Optional: Google Maps API key (restricted) for map view

## Required environment variables
- `VITE_SUPABASE_URL` — Supabase URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key
- `VITE_GOOGLE_MAPS_API_KEY` — (optional) Maps JS API key
- `GMAIL_PROXY_CLIENT_ID` and `GMAIL_PROXY_CLIENT_SECRET` — for backend proxy OAuth (if using server-side exchange)

## Database schema (minimal)
Run the following SQL in Supabase SQL editor to create core tables (MVP):

```sql
-- Extension for uuid generation (if needed)
create extension if not exists "pgcrypto";

create table if not exists app_users (
  id uuid primary key,
  email text not null unique,
  is_active boolean default true,
  name text,
  picture text,
  last_login_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists concerts (
  id uuid primary key default gen_random_uuid(),
  date_start timestamptz not null,
  date_end timestamptz,
  status text not null default 'scheduled',
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
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Example: simple RLS policy template (adjust as needed)
-- Enable row-level security
alter table concerts enable row level security;

-- Policy: allow authenticated users listed in app_users with is_active = true to select
create policy "select_for_active_users" on concerts
  for select
  using (exists (select 1 from app_users au where au.id = auth.uid() and au.is_active = true));

-- Policy: allow insert for authenticated users
create policy "insert_for_auth" on concerts
  for insert
  with check (auth.uid() is not null);
```

## Run frontend (development)

```bash
# from repo root
cd frontend
pnpm install
pnpm dev
```

## Run backend proxy (development)

```bash
cd backend
pnpm install
# set GMAIL_PROXY_CLIENT_ID and SECRET in env
pnpm dev
```

## Notes
- The frontend uses Supabase Auth for sign-in (Google). The Gmail mailbox lookup is proxied via the backend to avoid exposing tokens client-side.
- For acceptance tests, seed `app_users` with known `id` values that match Supabase auth UIDs and set `is_active = true`.
