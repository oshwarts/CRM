-- Developer user: one flagged account can "become" another existing user to test the system exactly as that user
-- experiences it. Everything the database decides by "who is this" goes through effective_uid(), which is the
-- impersonated user for a developer and the signed-in user for everybody else.
-- The audit log keeps the REAL signed-in user and marks the actions as done while impersonating.

alter table public.profiles
  add column if not exists is_developer boolean not null default false,
  add column if not exists impersonating_id uuid references public.profiles (id) on delete set null;

create or replace function public.effective_uid()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case when p.is_developer then p.impersonating_id end from public.profiles p where p.id = auth.uid()),
    auth.uid()
  )
$$;

-- who the user is (role) follows the effective user; "is the signed-in account active" stays the real account
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = public.effective_uid() and role = 'admin');
$$;

create or replace function public.can_access_project(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select pid is not null and (
    public.is_admin()
    or exists (select 1 from public.projects p where p.id = pid and p.owner_id = public.effective_uid())
  )
$$;

-- nobody can set the developer flag or the impersonation through the API: the flag is set by the database owner,
-- the impersonation only by set_impersonation() below (which runs as the owner, so current_user is not 'authenticated')
create or replace function public.protect_developer_fields()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      if new.is_developer or new.impersonating_id is not null then
        raise exception 'not allowed';
      end if;
    elsif new.is_developer is distinct from old.is_developer or new.impersonating_id is distinct from old.impersonating_id then
      raise exception 'not allowed';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_developer on public.profiles;
create trigger profiles_protect_developer
  before insert or update on public.profiles
  for each row execute function public.protect_developer_fields();

create or replace function public.set_impersonation(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_developer and active) then
    raise exception 'not allowed';
  end if;
  if target = auth.uid() then target := null; end if;
  if target is not null and not exists (select 1 from public.profiles where id = target and active) then
    raise exception 'unknown or inactive user';
  end if;
  update public.profiles set impersonating_id = target where id = auth.uid();
end;
$$;

revoke all on function public.set_impersonation(uuid) from public, anon;
grant execute on function public.set_impersonation(uuid) to authenticated;
revoke all on function public.effective_uid() from public, anon;
grant execute on function public.effective_uid() to authenticated;

-- the audit log: real user stays the actor; while impersonating, the effective user is recorded in detail
create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  j jsonb;
  o jsonb;
  changed text[];
  lbl text := '';
  uname text;
  det jsonb;
  eff uuid;
  ename text;
begin
  begin
    if tg_op = 'DELETE' then j := to_jsonb(old); else j := to_jsonb(new); end if;
    if tg_op = 'UPDATE' then
      o := to_jsonb(old);
      select coalesce(array_agg(k order by k), '{}') into changed
        from jsonb_object_keys(j) k
        where k <> 'updated_at' and (j -> k) is distinct from (o -> k);
      if coalesce(array_length(changed, 1), 0) = 0 then return new; end if;
    end if;
    if tg_table_name <> 'patient_scans' then
      lbl := coalesce(nullif(j ->> 'name', ''), nullif(j ->> 'subject', ''), nullif(j ->> 'description', ''),
                      nullif(j ->> 'title', ''), nullif(j ->> 'email', ''), nullif(j ->> 'competitor', ''), '');
    end if;
    if tg_table_name = 'profiles' and tg_op = 'UPDATE' then
      det := jsonb_build_object('role', j ->> 'role', 'active', j ->> 'active');
    end if;
    select full_name into uname from public.profiles where id = auth.uid();
    eff := public.effective_uid();
    if eff is not null and eff is distinct from auth.uid() then
      select full_name into ename from public.profiles where id = eff;
      det := coalesce(det, '{}'::jsonb) || jsonb_build_object('as_user_id', eff, 'as_user_name', coalesce(ename, ''));
    end if;
    insert into public.audit_log (user_id, user_name, table_name, action, record_id, label, changed_fields, detail)
    values (auth.uid(), coalesce(uname, ''), tg_table_name, lower(tg_op), coalesce(j ->> 'id', ''), left(lbl, 120),
            coalesce(changed, '{}'), det);
  exception when others then
    null;
  end;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- ownership-based policies and defaults follow the effective user
alter policy agent_goals_own_read on public.agent_goals using (agent_id = public.effective_uid());
alter policy favorites_own on public.favorites using (user_id = public.effective_uid()) with check (user_id = public.effective_uid());
alter policy meeting_tasks_select on public.meeting_tasks
  using (assignee_id = public.effective_uid() or created_by = public.effective_uid() or public.is_admin() or public.can_access_project(project_id));
alter policy meeting_tasks_insert on public.meeting_tasks
  with check (public.is_admin() or (assignee_id = public.effective_uid() and created_by = public.effective_uid())
    or (public.can_access_project(project_id) and created_by = public.effective_uid()));
alter policy meeting_tasks_delete on public.meeting_tasks
  using (assignee_id = public.effective_uid() or created_by = public.effective_uid() or public.is_admin() or public.can_access_project(project_id));
alter policy meeting_tasks_update on public.meeting_tasks
  using (assignee_id = public.effective_uid() or created_by = public.effective_uid() or public.is_admin() or public.can_access_project(project_id))
  with check (assignee_id = public.effective_uid() or created_by = public.effective_uid() or public.is_admin() or public.can_access_project(project_id));
alter policy projects_delete on public.projects using (owner_id = public.effective_uid() or public.is_admin());
alter policy projects_update on public.projects
  using (owner_id = public.effective_uid() or public.is_admin()) with check (owner_id = public.effective_uid() or public.is_admin());
alter policy projects_insert on public.projects with check (owner_id = public.effective_uid() or public.is_admin());

alter table public.competitor_intel alter column created_by set default public.effective_uid();
alter table public.meeting_tasks alter column assignee_id set default public.effective_uid();
alter table public.meeting_tasks alter column created_by set default public.effective_uid();
alter table public.projects alter column owner_id set default public.effective_uid();
alter table public.project_files alter column uploaded_by set default public.effective_uid();
alter table public.project_updates alter column author_id set default public.effective_uid();
alter table public.agent_goals alter column created_by set default public.effective_uid();
alter table public.agent_reviews alter column created_by set default public.effective_uid();
alter table public.agent_notes alter column created_by set default public.effective_uid();

-- the one developer account (the owner of the system)
update public.profiles set is_developer = true where id = '39489796-4d76-46b2-b0c0-146257f18c12';
