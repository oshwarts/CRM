-- The contact of a hospital who coordinates the CT appointments (chosen from the system's contacts).
-- Deliberately a plain uuid, NOT a foreign key: contacts already references hospitals, and a second
-- relationship between the two makes every PostgREST embed of one in the other ambiguous.
alter table public.hospitals add column if not exists scan_contact_id uuid;
alter table public.hospitals drop constraint if exists hospitals_scan_contact_id_fkey;
create index if not exists hospitals_scan_contact_idx on public.hospitals (scan_contact_id) where scan_contact_id is not null;
