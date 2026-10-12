-- User management: new sign-ups wait for admin approval, admins can deactivate users.
-- An inactive user is locked out of every table and of the document storage (restrictive policies).

alter table public.profiles
  add column active boolean not null default true,
  add column status_changed_at timestamptz,
  add column status_changed_by uuid references public.profiles(id) on delete set null;

create or replace function public.is_active()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select active from public.profiles where id = auth.uid()), false)
$$;

-- new sign-ups are inactive until an admin approves them (the very first user is the admin)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_first boolean;
begin
  select count(*) = 0 into is_first from public.profiles;
  insert into public.profiles (id, full_name, email, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.email, ''),
    case when is_first then 'admin' else 'agent' end,
    is_first
  );
  return new;
end;
$$;

-- only admins change role / active; the last active admin can never be removed
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.active is distinct from old.active) and not public.is_admin() then
    raise exception 'only admins can change role or status';
  end if;
  if new.active is distinct from old.active then
    new.status_changed_at := now();
    new.status_changed_by := auth.uid();
  end if;
  if old.role = 'admin' and old.active and (new.role <> 'admin' or not new.active) then
    if not exists (select 1 from public.profiles where role = 'admin' and active and id <> old.id) then
      raise exception 'cannot remove the last active admin';
    end if;
  end if;
  return new;
end;
$$;

-- admin-only: last sign-in time per user (lives in auth.users, not readable from the client)
create or replace function public.admin_user_activity()
returns table (id uuid, last_sign_in_at timestamptz)
language sql stable security definer set search_path = public as $$
  select u.id, u.last_sign_in_at from auth.users u where public.is_admin()
$$;

-- lock every data table to active users (AND-ed with the existing permissive policies)
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename <> 'profiles' loop
    execute format('create policy %I on public.%I as restrictive for all to authenticated using ((select public.is_active())) with check ((select public.is_active()))', 'active_users_only', t);
  end loop;
end $$;

-- a deactivated user can still read his own profile (to see the "pending" screen), nothing else
create policy profiles_active_only on public.profiles as restrictive for all to authenticated
  using (id = (select auth.uid()) or (select public.is_active()))
  with check (id = (select auth.uid()) or (select public.is_active()));

create policy info_docs_active_only on storage.objects as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

-- hardening from the security advisor
alter function public.set_updated_at() set search_path = public;
alter function public.doctor_hospital_sector_from_hospital() set search_path = public;
alter function public.cascade_hospital_sector() set search_path = public;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.protect_profile_role() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_active() from public, anon;
revoke execute on function public.admin_user_activity() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active() to authenticated;
grant execute on function public.admin_user_activity() to authenticated;
