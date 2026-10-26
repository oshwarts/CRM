-- The contact of a hospital who coordinates the CT appointments (chosen from the system's contacts)
alter table public.hospitals
  add column if not exists scan_contact_id uuid references public.contacts(id) on delete set null;
create index if not exists hospitals_scan_contact_idx on public.hospitals (scan_contact_id) where scan_contact_id is not null;
