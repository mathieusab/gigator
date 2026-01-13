-- Gmail connections storage (Option B: separate Gmail account connection)
--
-- Stores an encrypted refresh token for a Gmail account connected to an app user.
-- Encryption is handled in the backend; DB stores ciphertext only.

create table if not exists gmail_connections (
  app_user_id uuid primary key references app_users(id) on delete cascade,
  gmail_email text not null,
  refresh_token_ciphertext text not null,
  refresh_token_iv text not null,
  refresh_token_tag text not null,
  scopes text[],
  last_connected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gmail_connections_gmail_email_idx on gmail_connections(gmail_email);

-- Lock down table from direct client access. Only service-role backend should read/write.
alter table gmail_connections enable row level security;

drop policy if exists gmail_connections_no_access on gmail_connections;
create policy gmail_connections_no_access
  on gmail_connections
  for all
  using (false)
  with check (false);
