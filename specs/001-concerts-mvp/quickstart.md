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
- `GMAIL_PROXY_CLIENT_ID` and `GMAIL_PROXY_CLIENT_SECRET` — for backend proxy OAuth
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — backend-only, to store Gmail refresh tokens (Option B)
- `GMAIL_TOKEN_ENCRYPTION_KEY` — backend-only, encrypts refresh tokens at rest (Option B)
- `GMAIL_OAUTH_STATE_SECRET` — backend-only, signs OAuth state (Option B)
- `FRONTEND_ORIGIN` and `GMAIL_OAUTH_REDIRECT_URI` — backend-only, for OAuth redirects (Option B)
- `SLACK_WEBHOOK_URL` — backend-only, optional, to post concert updates to Slack
- `SLACK_CHANNEL` — backend-only, optional, channel override for Incoming Webhook (if allowed)
- `SLACK_FRONTEND_BASE_URL` — backend-only, optional, base URL used to build links in Slack (defaults to `http://localhost:5173`)

## Database schema (minimal)

Run the following SQL in Supabase SQL editor to create core tables (MVP):

````sql
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
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  -- The frontend expects a stored title (it derives one when missing)
  title text not null,
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

alter table concerts add constraint if not exists date_end_after_start
  check (date_end is null or date_end >= date_start);

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

## If you see "schema cache" errors

If you get an error like `Could not find the 'date_end' column of 'concerts' in the schema cache`, it means either:
- your `concerts` table was created without that column (common if you created it before updating SQL), or
- PostgREST (Supabase API) hasn’t refreshed its schema cache yet.

Run this in the Supabase SQL editor:

```sql
alter table public.concerts add column if not exists date_end timestamptz;
alter table public.concerts add column if not exists title text;

-- refresh PostgREST schema cache
notify pgrst, 'reload schema';
````

## Notes about current UI behavior

- The create/edit concert form currently requires `city` (even though the DB column can be nullable).
- Concerts are stored and queried directly from the frontend using `@supabase/supabase-js`.
- Gmail lookup is performed via the backend proxy (`/gmail/*`).

````

## Run frontend (development)

```bash
# from repo root
pnpm install
pnpm dev:frontend
````

## Run backend proxy (development)

```bash
# from repo root
pnpm install
# set GMAIL_PROXY_CLIENT_ID and SECRET in env
pnpm dev:backend
```

## Run both (development)

```bash
pnpm install
pnpm dev:full
```

## Notes

- The frontend uses Supabase Auth for sign-in (Google). The Gmail mailbox lookup is proxied via the backend to avoid exposing tokens client-side.
- **Option B (recommended)**: The Gmail account used for mailbox lookup can be different from the Google account used to sign in to the app.
  - Users connect Gmail via the backend OAuth flow and the backend stores an **encrypted refresh token** in Supabase.
  - Apply the SQL in `specs/001-concerts-mvp/sql/gmail_connections.sql` to create the storage table.
- For acceptance tests, seed `app_users` with known `id` values that match Supabase auth UIDs and set `is_active = true`.
