-- Fictitious test users for the developer account: one agent and one admin. They are real rows (so all the
-- ownership logic works) but nobody can sign in as them (banned, no password) and nobody except the developer
-- can even see them. The developer switches to them like to any user (set_impersonation) and can wipe what they
-- created with reset_test_user().

alter table public.profiles add column if not exists is_test boolean not null default false;

create or replace function public.is_real_developer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_developer and active)
$$;
revoke all on function public.is_real_developer() from public, anon;
grant execute on function public.is_real_developer() to authenticated;

create or replace function public.protect_developer_fields()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      if new.is_developer or new.is_test or new.impersonating_id is not null then
        raise exception 'not allowed';
      end if;
    elsif new.is_developer is distinct from old.is_developer
       or new.is_test is distinct from old.is_test
       or new.impersonating_id is distinct from old.impersonating_id then
      raise exception 'not allowed';
    end if;
  end if;
  return new;
end;
$$;

-- the two accounts (cannot log in: banned forever, no password)
insert into auth.users (id, instance_id, aud, role, email, banned_until, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'test-agent@test.invalid', 'infinity', '{"full_name":"משתמש בדיקה (סוכן)"}', now(), now()),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'test-admin@test.invalid', 'infinity', '{"full_name":"משתמש בדיקה (מנהל)"}', now(), now())
on conflict (id) do nothing;

-- the role guard only lets admins change roles; this migration runs without a signed-in user
alter table public.profiles disable trigger profiles_protect_role;

insert into public.profiles (id, full_name, email, role, active, is_test)
values
  ('00000000-0000-4000-8000-0000000000a1', 'משתמש בדיקה (סוכן)', 'test-agent@test.invalid', 'agent', true, true),
  ('00000000-0000-4000-8000-0000000000a2', 'משתמש בדיקה (מנהל)', 'test-admin@test.invalid', 'admin', true, true)
on conflict (id) do update
  set full_name = excluded.full_name, email = excluded.email, role = excluded.role, active = true, is_test = true;

alter table public.profiles enable trigger profiles_protect_role;

-- only the developer sees the test users
create policy profiles_hide_test on public.profiles
  as restrictive for select to authenticated
  using (not is_test or public.is_real_developer());

-- deletes everything a test user created (tasks, projects, meetings, scans, goals, notes …)
-- (reset_test_user is defined in 038)
