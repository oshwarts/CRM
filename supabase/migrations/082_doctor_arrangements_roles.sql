-- A doctor: the health funds and private insurers he has an arrangement with (for a doctor who works in a private hospital),
-- and further roles he holds (for example the chair of a society).

create table public.doctor_arrangements (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  kind text not null default 'other' check (kind in ('fund', 'insurer', 'other')),
  provider text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (doctor_id, provider)
);
create index doctor_arrangements_doctor_idx on public.doctor_arrangements (doctor_id);

create table public.doctor_roles (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  title text not null,
  organization text not null default '',
  note text not null default '',
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index doctor_roles_doctor_idx on public.doctor_roles (doctor_id, sort);

do $$
declare t text;
begin
  foreach t in array array['doctor_arrangements', 'doctor_roles'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', t || '_all', t);
    execute format('create policy active_users_only on public.%I as restrictive for all to authenticated using ((select public.is_active())) with check ((select public.is_active()))', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()', 'audit_' || t, t);
  end loop;
end $$;
