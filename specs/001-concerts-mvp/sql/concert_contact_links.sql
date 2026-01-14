-- Concerts ↔ Contacts (many-to-many)
--
-- Allows attaching multiple contacts to a single concert.
-- The existing `concerts.contact_id` can remain as an optional "primary" contact for legacy UIs.

create extension if not exists "pgcrypto";

create table if not exists concert_contact_links (
  id uuid primary key default gen_random_uuid(),
  concert_id uuid not null references concerts(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (concert_id, contact_id)
);

-- If the table already existed from a previous iteration, ensure new columns & constraints exist.
alter table concert_contact_links add column if not exists category text;

alter table concert_contact_links drop constraint if exists concert_contact_links_category_check;
alter table concert_contact_links add constraint concert_contact_links_category_check check (
  category is null
  or category in (
    'Gérant',
    'Ingé son',
    'Ingé lumière',
    'Organisateur',
    'Responsable bar',
    'Connaissance',
    'Membre du co-plateau'
  )
);

create index if not exists concert_contact_links_concert_id_idx on concert_contact_links(concert_id);
create index if not exists concert_contact_links_contact_id_idx on concert_contact_links(contact_id);

-- RLS (aligned with concerts creator access)
alter table concert_contact_links enable row level security;

drop policy if exists concert_contact_links_select_for_active_users on concert_contact_links;
create policy concert_contact_links_select_for_active_users
  on concert_contact_links
  for select
  using (
    exists (
      select 1
      from concerts c
      join app_users au on au.id = auth.uid()
      where c.id = concert_contact_links.concert_id
        and au.is_active = true
    )
  );

drop policy if exists concert_contact_links_insert_for_creator on concert_contact_links;
create policy concert_contact_links_insert_for_creator
  on concert_contact_links
  for insert
  with check (
    exists (
      select 1
      from concerts c
      join app_users au on au.id = auth.uid()
      where c.id = concert_contact_links.concert_id
        and c.created_by = auth.uid()
        and au.is_active = true
    )
  );

drop policy if exists concert_contact_links_delete_for_creator on concert_contact_links;
create policy concert_contact_links_delete_for_creator
  on concert_contact_links
  for delete
  using (
    exists (
      select 1
      from concerts c
      join app_users au on au.id = auth.uid()
      where c.id = concert_contact_links.concert_id
        and c.created_by = auth.uid()
        and au.is_active = true
    )
  );
