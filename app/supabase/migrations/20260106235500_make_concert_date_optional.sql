-- Allow planning a concert without an exact date yet

alter table public.concerts
alter column date_start drop not null;
