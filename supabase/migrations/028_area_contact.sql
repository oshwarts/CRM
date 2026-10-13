-- A default contact per project area (usually one person handles a whole area, e.g. procurement).
alter table public.project_areas
  add column contact_id uuid references public.contacts(id) on delete set null,
  add column contact_text text not null default '';
