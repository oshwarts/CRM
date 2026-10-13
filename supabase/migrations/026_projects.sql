-- Projects: a big goal (e.g. a MAKO integration in a hospital) split into areas, each with tasks.
-- Tasks stay in meeting_tasks (one tasks table for everything) and get a status, an area and "waiting for" fields.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  hospital_id uuid references public.hospitals(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null default auth.uid(),
  status text not null default 'active' check (status in ('active', 'on_hold', 'done')),
  start_date date,
  target_date date,
  template_key text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (project_id, user_id)
);

create table public.project_areas (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index project_areas_project_idx on public.project_areas (project_id, sort);

alter table public.meeting_tasks
  add column project_id uuid references public.projects(id) on delete cascade,
  add column area_id uuid references public.project_areas(id) on delete set null,
  add column status text not null default 'todo' check (status in ('todo', 'in_progress', 'blocked', 'done')),
  add column waiting_for text not null default '',
  add column external_owner text not null default '',
  add column contact_id uuid references public.contacts(id) on delete set null;
update public.meeting_tasks set status = 'done' where is_done;
create index meeting_tasks_project_idx on public.meeting_tasks (project_id, status);

-- the checkbox and the status always agree
create or replace function public.sync_task_status()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'done' then
      new.is_done := true;
      new.done_at := coalesce(new.done_at, now());
    elsif new.is_done then
      new.status := 'done';
    end if;
  elsif new.status is distinct from old.status then
    new.is_done := (new.status = 'done');
    new.done_at := case when new.status = 'done' then coalesce(new.done_at, now()) else null end;
  elsif new.is_done is distinct from old.is_done then
    new.status := case when new.is_done then 'done' else 'todo' end;
    new.done_at := case when new.is_done then coalesce(new.done_at, now()) else null end;
  end if;
  return new;
end;
$$;
create trigger meeting_tasks_sync_status before insert or update on public.meeting_tasks
  for each row execute function public.sync_task_status();

create table public.project_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid references public.meeting_tasks(id) on delete set null,
  author_id uuid references public.profiles(id) on delete set null default auth.uid(),
  author_name text not null default '',
  body text not null default '',
  created_at timestamptz not null default now()
);
create index project_updates_project_idx on public.project_updates (project_id, created_at desc);

create table public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid references public.meeting_tasks(id) on delete set null,
  update_id uuid references public.project_updates(id) on delete cascade,
  storage_path text not null,
  file_name text not null default '',
  file_size bigint not null default 0,
  mime text not null default '',
  uploaded_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index project_files_project_idx on public.project_files (project_id);

-- who may open a project: admins, its owner and its members
create or replace function public.can_access_project(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select pid is not null and (
    public.is_admin()
    or exists (select 1 from public.projects p where p.id = pid and p.owner_id = auth.uid())
    or exists (select 1 from public.project_members m where m.project_id = pid and m.user_id = auth.uid())
  )
$$;
revoke execute on function public.can_access_project(uuid) from public, anon;
grant execute on function public.can_access_project(uuid) to authenticated;

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_areas enable row level security;
alter table public.project_updates enable row level security;
alter table public.project_files enable row level security;

create policy projects_select on public.projects for select to authenticated using (public.can_access_project(id));
create policy projects_insert on public.projects for insert to authenticated with check (owner_id = auth.uid() or public.is_admin());
create policy projects_update on public.projects for update to authenticated
  using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
create policy projects_delete on public.projects for delete to authenticated using (owner_id = auth.uid() or public.is_admin());

create policy project_members_select on public.project_members for select to authenticated using (public.can_access_project(project_id));
create policy project_members_write on public.project_members for all to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and (p.owner_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.projects p where p.id = project_id and (p.owner_id = auth.uid() or public.is_admin())));

create policy project_areas_all on public.project_areas for all to authenticated
  using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));
create policy project_updates_all on public.project_updates for all to authenticated
  using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));
create policy project_files_all on public.project_files for all to authenticated
  using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));

do $$
declare t text;
begin
  foreach t in array array['projects', 'project_members', 'project_areas', 'project_updates', 'project_files'] loop
    execute format('create policy active_users_only on public.%I as restrictive for all to authenticated using ((select public.is_active())) with check ((select public.is_active()))', t);
  end loop;
end $$;

-- tasks of a project are visible to / editable by the project's people
drop policy meeting_tasks_select on public.meeting_tasks;
drop policy meeting_tasks_insert on public.meeting_tasks;
drop policy meeting_tasks_update on public.meeting_tasks;
drop policy meeting_tasks_delete on public.meeting_tasks;
create policy meeting_tasks_select on public.meeting_tasks for select to authenticated
  using (assignee_id = auth.uid() or created_by = auth.uid() or public.is_admin() or public.can_access_project(project_id));
create policy meeting_tasks_insert on public.meeting_tasks for insert to authenticated
  with check (
    public.is_admin()
    or (assignee_id = auth.uid() and created_by = auth.uid())
    or (public.can_access_project(project_id) and created_by = auth.uid())
  );
create policy meeting_tasks_update on public.meeting_tasks for update to authenticated
  using (assignee_id = auth.uid() or created_by = auth.uid() or public.is_admin() or public.can_access_project(project_id))
  with check (assignee_id = auth.uid() or created_by = auth.uid() or public.is_admin() or public.can_access_project(project_id));
create policy meeting_tasks_delete on public.meeting_tasks for delete to authenticated
  using (assignee_id = auth.uid() or created_by = auth.uid() or public.is_admin() or public.can_access_project(project_id));

-- sub-tasks follow their task (already: visible through the task's own policy)

create trigger audit_projects after insert or update or delete on public.projects
  for each row execute function public.audit_row();
