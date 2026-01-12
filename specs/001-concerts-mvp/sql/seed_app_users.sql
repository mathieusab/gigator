-- Seed example authorized users.
-- NOTE: In Supabase, `app_users.id` should match the Supabase Auth user UUID.

insert into app_users (id, email, is_active, name)
values
  ('00000000-0000-0000-0000-000000000001', 'active@example.com', true, 'Active User'),
  ('00000000-0000-0000-0000-000000000002', 'inactive@example.com', false, 'Inactive User')
on conflict (id) do update
set email = excluded.email,
    is_active = excluded.is_active,
    name = excluded.name;
