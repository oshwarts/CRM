-- Smart weekly roster: agents report their availability (full day, or per shift with a reason when unavailable),
-- managers assign where each agent works on a given day. Everyone reads everything, only an admin writes assignments;
-- an agent writes only their own availability (or an admin, on their behalf).

create table public.agent_availability (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  shift text not null check (shift in ('morning', 'evening')),
  status text not null default 'available' check (status in ('available', 'unavailable')),
  reason text not null default '',
  note text not null default '',
  updated_by uuid references public.profiles(id) on delete set null default public.effective_uid(),
  updated_at timestamptz not null default now(),
  unique (agent_id, date, shift)
);
create index agent_availability_date_idx on public.agent_availability (date);

create table public.schedule_assignments (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  shift text not null check (shift in ('morning', 'evening')),
  hospital_id uuid references public.hospitals(id) on delete set null,
  area text not null default '',
  work_type text not null default 'field' check (work_type in ('field', 'office', 'training', 'other')),
  task_id uuid references public.meeting_tasks(id) on delete set null,
  meeting_id uuid references public.meetings(id) on delete set null,
  note text not null default '',
  updated_by uuid references public.profiles(id) on delete set null default public.effective_uid(),
  updated_at timestamptz not null default now(),
  unique (agent_id, date, shift)
);
create index schedule_assignments_date_idx on public.schedule_assignments (date);
create index schedule_assignments_hospital_idx on public.schedule_assignments (hospital_id) where hospital_id is not null;

alter table public.agent_availability   enable row level security;
alter table public.schedule_assignments enable row level security;

create policy agent_availability_read on public.agent_availability
  for select to authenticated using (true);
create policy agent_availability_write on public.agent_availability
  for all to authenticated
  using (agent_id = public.effective_uid() or public.is_admin())
  with check (agent_id = public.effective_uid() or public.is_admin());
create policy active_users_only on public.agent_availability as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create policy schedule_assignments_read on public.schedule_assignments
  for select to authenticated using (true);
create policy schedule_assignments_write on public.schedule_assignments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy active_users_only on public.schedule_assignments as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create trigger agent_availability_updated_at before update on public.agent_availability
  for each row execute function public.set_updated_at();
create trigger schedule_assignments_updated_at before update on public.schedule_assignments
  for each row execute function public.set_updated_at();

create trigger audit_agent_availability after insert or update or delete on public.agent_availability
  for each row execute function public.audit_row();
create trigger audit_schedule_assignments after insert or update or delete on public.schedule_assignments
  for each row execute function public.audit_row();
