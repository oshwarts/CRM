-- A project is visible only to the managers and to the agent responsible for it (no extra team members).
create or replace function public.can_access_project(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select pid is not null and (
    public.is_admin()
    or exists (select 1 from public.projects p where p.id = pid and p.owner_id = auth.uid())
  )
$$;

drop table public.project_members;
