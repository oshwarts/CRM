-- Planned surgeries that are not MAKO surgeries (no CT scan, no patient file): a quick entry for the weekly schedule.
-- Deliberately no patient data here: date, time, surgeon, hospital, procedure, company, notes, and the agent attending.
create table public.planned_surgeries (
  id uuid primary key default gen_random_uuid(),
  surgery_date date not null,
  surgery_time time,
  doctor_id uuid references public.doctors(id) on delete set null,
  hospital_id uuid references public.hospitals(id) on delete set null,
  procedure text not null default '',
  company text not null default '',
  notes text not null default '',
  agent_id uuid references public.profiles(id) on delete set null default public.effective_uid(),
  status text not null default 'planned' check (status in ('planned', 'done', 'cancelled')),
  created_by uuid references public.profiles(id) on delete set null default public.effective_uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index planned_surgeries_date_idx on public.planned_surgeries (surgery_date);
create index planned_surgeries_doctor_idx on public.planned_surgeries (doctor_id);
create index planned_surgeries_hospital_idx on public.planned_surgeries (hospital_id);
create index planned_surgeries_agent_idx on public.planned_surgeries (agent_id);
create trigger planned_surgeries_updated_at before update on public.planned_surgeries
  for each row execute function public.set_updated_at();

alter table public.planned_surgeries enable row level security;
create policy planned_surgeries_select on public.planned_surgeries for select to authenticated using (true);
create policy planned_surgeries_insert on public.planned_surgeries for insert to authenticated with check (true);
create policy planned_surgeries_update on public.planned_surgeries for update to authenticated using (true) with check (true);
create policy planned_surgeries_delete on public.planned_surgeries for delete to authenticated
  using (public.is_admin() or created_by = public.effective_uid());
create policy active_users_only on public.planned_surgeries as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create trigger audit_planned_surgeries after insert or update or delete on public.planned_surgeries
  for each row execute function public.audit_row();

-- the test-user reset also clears these
create or replace function public.reset_test_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_real_developer() then raise exception 'not allowed'; end if;
  if not exists (select 1 from public.profiles where id = p_target and is_test) then
    raise exception 'not a test user';
  end if;
  delete from public.meeting_tasks where created_by = p_target or assignee_id = p_target;
  delete from public.project_updates where author_id = p_target;
  delete from public.projects where owner_id = p_target;
  delete from public.meetings where created_by = p_target;
  delete from public.patient_scans where created_by = p_target;
  delete from public.planned_surgeries where created_by = p_target;
  delete from public.competitor_intel where created_by = p_target;
  delete from public.consumable_counts where counted_by = p_target;
  delete from public.agent_goals where created_by = p_target or agent_id = p_target;
  delete from public.agent_reviews where created_by = p_target or agent_id = p_target;
  delete from public.agent_notes where created_by = p_target or agent_id = p_target;
  delete from public.agent_training where created_by = p_target or agent_id = p_target;
  delete from public.learn_progress where user_id = p_target;
  delete from public.learn_attempts where user_id = p_target;
  delete from public.learn_daily where user_id = p_target;
  delete from public.favorites where user_id = p_target;
  delete from public.hospital_agents where agent_id = p_target;
  delete from public.doctors where created_by = p_target;
end;
$$;
