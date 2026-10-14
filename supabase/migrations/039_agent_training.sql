-- Agent training: per agent and procedure, which stage was completed and when.
-- Fixed stages: theory -> observe -> guided -> solo -> certified. One row per completed stage.
-- Managers manage everything; an agent reads only his own.

create table public.agent_training (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles(id) on delete cascade,
  procedure_id uuid not null references public.procedures(id) on delete cascade,
  stage text not null check (stage in ('theory', 'observe', 'guided', 'solo', 'certified')),
  completed_on date not null default current_date,
  notes text not null default '',
  file_path text,
  file_name text not null default '',
  created_by uuid references public.profiles(id) on delete set null default public.effective_uid(),
  created_at timestamptz not null default now(),
  unique (agent_id, procedure_id, stage)
);
create index agent_training_agent_idx on public.agent_training (agent_id);

alter table public.agent_training enable row level security;

create policy agent_training_admin on public.agent_training for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy agent_training_own_read on public.agent_training for select to authenticated using (agent_id = public.effective_uid());
create policy active_users_only on public.agent_training as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create trigger audit_agent_training after insert or update or delete on public.agent_training
  for each row execute function public.audit_row();
