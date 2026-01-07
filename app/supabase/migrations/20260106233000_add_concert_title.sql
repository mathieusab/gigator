-- Add missing title column expected by the app

alter table public.concerts
add column if not exists title text;

update public.concerts
set title = coalesce(title, venue_name, '')
where title is null;

alter table public.concerts
alter column title set not null;
