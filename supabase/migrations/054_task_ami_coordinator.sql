-- "AMI coordinator" of a task: a contact of the system and/or free text (the person at AMI who coordinates it)
alter table public.meeting_tasks
  add column if not exists coordinator_contact_id uuid references public.contacts(id) on delete set null,
  add column if not exists coordinator_text text not null default '';
create index if not exists meeting_tasks_coordinator_idx on public.meeting_tasks (coordinator_contact_id) where coordinator_contact_id is not null;
