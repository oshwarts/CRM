create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'only admins can change role';
  end if;
  return new;
end;
$$;
create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

alter table public.profiles          enable row level security;
alter table public.companies         enable row level security;
alter table public.hospitals         enable row level security;
alter table public.hospital_agents   enable row level security;
alter table public.procedures        enable row level security;
alter table public.doctors           enable row level security;
alter table public.doctor_companies  enable row level security;
alter table public.doctor_hospitals  enable row level security;
alter table public.doctor_procedures enable row level security;
alter table public.doctor_preop_plans enable row level security;
alter table public.favorites         enable row level security;
alter table public.meetings          enable row level security;
alter table public.meeting_doctors   enable row level security;
alter table public.meeting_tasks     enable row level security;

create policy "profiles_select" on public.profiles for select to authenticated using (true);
create policy "profiles_update_self" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy "companies_all" on public.companies for all to authenticated using (true) with check (true);
create policy "hospitals_all" on public.hospitals for all to authenticated using (true) with check (true);
create policy "hospital_agents_all" on public.hospital_agents for all to authenticated using (true) with check (true);
create policy "procedures_all" on public.procedures for all to authenticated using (true) with check (true);
create policy "doctors_all" on public.doctors for all to authenticated using (true) with check (true);
create policy "doctor_companies_all" on public.doctor_companies for all to authenticated using (true) with check (true);
create policy "doctor_hospitals_all" on public.doctor_hospitals for all to authenticated using (true) with check (true);
create policy "doctor_procedures_all" on public.doctor_procedures for all to authenticated using (true) with check (true);
create policy "doctor_preop_plans_all" on public.doctor_preop_plans for all to authenticated using (true) with check (true);
create policy "meetings_all" on public.meetings for all to authenticated using (true) with check (true);
create policy "meeting_doctors_all" on public.meeting_doctors for all to authenticated using (true) with check (true);
create policy "meeting_tasks_all" on public.meeting_tasks for all to authenticated using (true) with check (true);

create policy "favorites_own" on public.favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
