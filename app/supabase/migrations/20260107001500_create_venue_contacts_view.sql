-- Aggregate venue contacts from concerts
-- This provides a directory-like view without duplicating data.

create or replace view public.venue_contacts as
select
  encode(
    digest(
      concat_ws(
        '|',
        c.venue_name,
        coalesce(nullif(trim(c.venue_contact_email), ''), ''),
        coalesce(nullif(trim(c.venue_contact_phone), ''), ''),
        coalesce(nullif(trim(c.venue_contact_name), ''), '')
      ),
      'sha256'
    ),
    'hex'
  ) as id,
  c.venue_name,
  nullif(trim(c.venue_contact_name), '') as venue_contact_name,
  nullif(trim(c.venue_contact_email), '') as venue_contact_email,
  nullif(trim(c.venue_contact_phone), '') as venue_contact_phone,
  max(c.updated_at) as last_contact_at
from public.concerts c
where
  nullif(trim(c.venue_name), '') is not null
  and (
    nullif(trim(c.venue_contact_name), '') is not null
    or nullif(trim(c.venue_contact_email), '') is not null
    or nullif(trim(c.venue_contact_phone), '') is not null
  )
group by
  c.venue_name,
  nullif(trim(c.venue_contact_name), ''),
  nullif(trim(c.venue_contact_email), ''),
  nullif(trim(c.venue_contact_phone), '');

grant select on public.venue_contacts to authenticated;
