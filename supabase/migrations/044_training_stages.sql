-- Training becomes configurable: the manager defines the stages (a stage without a procedure applies to the agent
-- in general, e.g. JR101 and the MAKO course; a stage of a procedure e.g. "6 solo surgeries"), each stage with the
-- number of completions it needs. An agent's progress is one row per completion (a solo surgery, a course …).
-- Replaces the fixed five-stage ladder of 039 (that table held no data yet).

drop table public.agent_training;

create table public.training_stages (
  id uuid primary key default gen_random_uuid(),
  procedure_id uuid references public.procedures(id) on delete cascade,
  name text not null,
  required_count int not null default 1 check (required_count >= 1),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index training_stages_procedure_idx on public.training_stages (procedure_id, sort);

create table public.agent_training (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles(id) on delete cascade,
  stage_id uuid not null references public.training_stages(id) on delete cascade,
  completed_on date not null default current_date,
  notes text not null default '',
  file_path text,
  file_name text not null default '',
  created_by uuid references public.profiles(id) on delete set null default public.effective_uid(),
  created_at timestamptz not null default now()
);
create index agent_training_agent_idx on public.agent_training (agent_id, stage_id);

alter table public.training_stages enable row level security;
alter table public.agent_training enable row level security;

-- stages: everybody signed in reads (an agent sees what is required of him), managers edit
create policy training_stages_read on public.training_stages for select to authenticated using (true);
create policy training_stages_admin on public.training_stages for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy agent_training_admin on public.agent_training for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy agent_training_own_read on public.agent_training for select to authenticated using (agent_id = public.effective_uid());

create policy active_users_only on public.training_stages as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));
create policy active_users_only on public.agent_training as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create trigger audit_training_stages after insert or update or delete on public.training_stages
  for each row execute function public.audit_row();
create trigger audit_agent_training after insert or update or delete on public.agent_training
  for each row execute function public.audit_row();

-- starting set: two general courses, and 6 solo surgeries for each MAKO procedure
insert into public.training_stages (procedure_id, name, required_count, sort) values
  (null, 'JR101', 1, 0),
  (null, 'קורס MAKO', 1, 1);
insert into public.training_stages (procedure_id, name, required_count, sort)
  select id, 'ניתוחי סולו', 6, 0 from public.procedures where planning_template like 'mako%';
