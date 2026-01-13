-- RLS policies for Concerts MVP

-- app_users: user can read their own row (needed to gate app access)
alter table app_users enable row level security;

drop policy if exists app_users_select_self on app_users;
create policy app_users_select_self
  on app_users
  for select
  using (id = auth.uid());

-- concerts: only active users can access, and only creators can mutate
alter table concerts enable row level security;

drop policy if exists concerts_select_for_active_users on concerts;
create policy concerts_select_for_active_users
  on concerts
  for select
  using (
    exists (
      select 1
      from app_users au
      where au.id = auth.uid()
        and au.is_active = true
    )
  );

drop policy if exists concerts_insert_for_active_users on concerts;
create policy concerts_insert_for_active_users
  on concerts
  for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from app_users au
      where au.id = auth.uid()
        and au.is_active = true
    )
  );

drop policy if exists concerts_update_for_creator on concerts;
create policy concerts_update_for_creator
  on concerts
  for update
  using (created_by = auth.uid())
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from app_users au
      where au.id = auth.uid()
        and au.is_active = true
    )
  );

drop policy if exists concerts_delete_for_creator on concerts;
create policy concerts_delete_for_creator
  on concerts
  for delete
  using (
    created_by = auth.uid()
    and exists (
      select 1
      from app_users au
      where au.id = auth.uid()
        and au.is_active = true
    )
  );

-- concert_financial_items: readable by active users, writable by the concert creator
alter table concert_financial_items enable row level security;

drop policy if exists concert_financial_items_select_for_active_users on concert_financial_items;
create policy concert_financial_items_select_for_active_users
  on concert_financial_items
  for select
  using (
    exists (
      select 1
      from app_users au
      where au.id = auth.uid()
        and au.is_active = true
    )
  );

drop policy if exists concert_financial_items_insert_for_concert_creator on concert_financial_items;
create policy concert_financial_items_insert_for_concert_creator
  on concert_financial_items
  for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from concerts c
      where c.id = concert_id
        and c.created_by = auth.uid()
    )
    and exists (
      select 1
      from app_users au
      where au.id = auth.uid()
        and au.is_active = true
    )
  );

drop policy if exists concert_financial_items_update_for_concert_creator on concert_financial_items;
create policy concert_financial_items_update_for_concert_creator
  on concert_financial_items
  for update
  using (
    exists (
      select 1
      from concerts c
      where c.id = concert_id
        and c.created_by = auth.uid()
    )
  )
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from concerts c
      where c.id = concert_id
        and c.created_by = auth.uid()
    )
    and exists (
      select 1
      from app_users au
      where au.id = auth.uid()
        and au.is_active = true
    )
  );

drop policy if exists concert_financial_items_delete_for_concert_creator on concert_financial_items;
create policy concert_financial_items_delete_for_concert_creator
  on concert_financial_items
  for delete
  using (
    exists (
      select 1
      from concerts c
      where c.id = concert_id
        and c.created_by = auth.uid()
    )
    and exists (
      select 1
      from app_users au
      where au.id = auth.uid()
        and au.is_active = true
    )
  );
