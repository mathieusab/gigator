-- Add free-form contact field (name / email / phone)

alter table public.concerts
add column if not exists contact text;
