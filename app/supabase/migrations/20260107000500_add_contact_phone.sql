-- Add phone number for venue contact

alter table public.concerts
add column if not exists venue_contact_phone text;
