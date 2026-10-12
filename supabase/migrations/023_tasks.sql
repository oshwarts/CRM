-- Task manager: the existing meeting_tasks table becomes the single tasks table
-- (meeting tasks and stand-alone tasks live together). Each agent sees his own tasks, admins see all.

alter table public.meeting_tasks
  alter column meeting_id drop not null,
  add column assignee_id uuid references public.profiles(id) on delete set null default auth.uid(),
  add column created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  add column priority text not null default 'normal' check (priority in ('normal', 'urgent')),
  add column notes text not null default '',
  add column doctor_id uuid references public.doctors(id) on delete set null,
  add column hospital_id uuid references public.hospitals(id) on delete set null,
  add column recurrence text not null default 'none' check (recurrence in ('none', 'weekly', 'monthly')),
  add column done_at timestamptz,
  add column updated_at timestamptz not null default now();

-- existing meeting tasks: belong to the meeting's responsible agent (or the first admin)
update public.meeting_tasks t set
  assignee_id = coalesce(m.responsible_agent_id, (select id from public.profiles where role = 'admin' order by created_at limit 1)),
  created_by  = coalesce(m.responsible_agent_id, (select id from public.profiles where role = 'admin' order by created_at limit 1)),
  hospital_id = m.hospital_id,
  doctor_id   = (select md.doctor_id from public.meeting_doctors md where md.meeting_id = t.meeting_id limit 1),
  done_at     = case when t.is_done then t.created_at end
from public.meetings m
where m.id = t.meeting_id;

create trigger meeting_tasks_updated_at before update on public.meeting_tasks
  for each row execute function public.set_updated_at();
create index meeting_tasks_assignee_idx on public.meeting_tasks (assignee_id, is_done, due_date);

create table public.task_subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.meeting_tasks(id) on delete cascade,
  text text not null default '',
  is_done boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index task_subtasks_task_idx on public.task_subtasks (task_id);

alter table public.task_subtasks enable row level security;

drop policy "meeting_tasks_all" on public.meeting_tasks;
create policy meeting_tasks_select on public.meeting_tasks for select to authenticated
  using (assignee_id = auth.uid() or created_by = auth.uid() or public.is_admin());
create policy meeting_tasks_insert on public.meeting_tasks for insert to authenticated
  with check (public.is_admin() or (assignee_id = auth.uid() and created_by = auth.uid()));
create policy meeting_tasks_update on public.meeting_tasks for update to authenticated
  using (assignee_id = auth.uid() or created_by = auth.uid() or public.is_admin())
  with check (assignee_id = auth.uid() or created_by = auth.uid() or public.is_admin());
create policy meeting_tasks_delete on public.meeting_tasks for delete to authenticated
  using (assignee_id = auth.uid() or created_by = auth.uid() or public.is_admin());

-- sub-tasks follow the visibility of their parent task
create policy task_subtasks_all on public.task_subtasks for all to authenticated
  using (exists (select 1 from public.meeting_tasks t where t.id = task_id))
  with check (exists (select 1 from public.meeting_tasks t where t.id = task_id));
create policy active_users_only on public.task_subtasks as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));
