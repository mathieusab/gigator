# Concerts MVP — Spec README

This folder contains the spec artifacts for the Concerts MVP, plus runnable SQL and tests.

## What’s implemented

- Supabase Auth (Google) + app-level access gate via `app_users.is_active`
- Concert CRUD in the frontend (list, calendar, map)
- Gmail thread lookup via backend proxy (`/gmail/threads`) with a connect flow

Notes (current code expectations):

- The frontend expects a `concerts.title` column (it derives a default when not provided).
- The concert form currently requires `city`.

## Quickstart (dev)

### 1) Install deps

```bash
pnpm install
```

### 2) Supabase: apply SQL

Apply these SQL files in your Supabase SQL editor (in order):

- `specs/001-concerts-mvp/sql/init.sql`
- `specs/001-concerts-mvp/sql/rls.sql`
- `specs/001-concerts-mvp/sql/seed_app_users.sql`
- (optional, for Gmail connect) `specs/001-concerts-mvp/sql/gmail_connections.sql`

If your `concerts` table predates the current frontend, ensure it has the `title` column:

```sql
alter table public.concerts add column if not exists title text;
notify pgrst, 'reload schema';
```

### 3) Configure env vars

Frontend (`frontend/.env`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GOOGLE_MAPS_API_KEY` (optional)

Backend (`backend/.env`, see `backend/.env.example`):

- `GMAIL_PROXY_CLIENT_ID`
- `GMAIL_PROXY_CLIENT_SECRET`
- `GMAIL_TOKEN_ENCRYPTION_KEY` (base64, 32 bytes)
- `GMAIL_OAUTH_STATE_SECRET`
- `GMAIL_OAUTH_REDIRECT_URI`
- `FRONTEND_ORIGIN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### 4) Run

```bash
pnpm dev:full
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

## Tests

```bash
pnpm -C frontend test
pnpm -C backend test
pnpm test:rls
```

## Acceptance checklist

- Sign in with an active user → can access concerts pages
- Sign in with inactive / missing user → redirected to Access Denied
- Create/edit/delete concert → reflected in list + calendar + map
- From concert detail with `venue_contact_email`, Gmail threads loads (or shows empty state)
- If Gmail isn’t connected or token is invalid, UI prompts to (re)connect
