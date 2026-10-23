-- Investigations v2: an investigation can involve several doctors, contacts and AMI staff, have several files, a hospital, a meeting,
-- a product, root-cause categories and a severity; its corrective actions are real tasks (meeting_tasks.investigation_id).

alter table public.doctor_investigations drop constraint doctor_investigations_doctor_id_fkey;
alter table public.doctor_investigations alter column doctor_id drop not null;
alter table public.doctor_investigations add constraint doctor_investigations_doctor_id_fkey foreign key (doctor_id) references public.doctors(id) on delete set null;
alter table public.doctor_investigations
  add column hospital_id uuid references public.hospitals(id) on delete set null,
  add column meeting_id uuid references public.meetings(id) on delete set null,
  add column product text not null default '',
  add column categories text[] not null default '{}',
  add column severity smallint not null default 2 check (severity between 1 and 3),
  add column closed_by uuid references public.profiles(id) on delete set null;
create index doctor_investigations_status_idx on public.doctor_investigations (status, event_date);

create table public.investigation_doctors (
  investigation_id uuid not null references public.doctor_investigations(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  primary key (investigation_id, doctor_id)
);
create table public.investigation_contacts (
  investigation_id uuid not null references public.doctor_investigations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  primary key (investigation_id, contact_id)
);
create table public.investigation_staff (
  investigation_id uuid not null references public.doctor_investigations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  primary key (investigation_id, profile_id)
);
create index investigation_doctors_doctor_idx on public.investigation_doctors (doctor_id);

create table public.investigation_files (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.doctor_investigations(id) on delete cascade,
  file_path text not null,
  file_name text not null default '',
  file_size bigint not null default 0,
  mime text not null default '',
  created_by uuid references public.profiles(id) on delete set null default public.effective_uid(),
  created_at timestamptz not null default now()
);
create index investigation_files_inv_idx on public.investigation_files (investigation_id);

-- what exists moves into the new tables
insert into public.investigation_doctors (investigation_id, doctor_id) select id, doctor_id from public.doctor_investigations where doctor_id is not null;
insert into public.investigation_files (investigation_id, file_path, file_name, file_size, mime, created_by, created_at)
  select id, file_path, file_name, file_size, mime, created_by, created_at from public.doctor_investigations where file_path is not null;

do $$
declare t text;
begin
  foreach t in array array['investigation_doctors', 'investigation_contacts', 'investigation_staff', 'investigation_files'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', t || '_all', t);
    execute format('create policy active_users_only on public.%I as restrictive for all to authenticated using ((select public.is_active())) with check ((select public.is_active()))', t);
  end loop;
end $$;

-- corrective actions are tasks of the system (they show on the tasks screen, with an owner and a due date)
alter table public.meeting_tasks add column investigation_id uuid references public.doctor_investigations(id) on delete set null;
create index meeting_tasks_investigation_idx on public.meeting_tasks (investigation_id) where investigation_id is not null;
