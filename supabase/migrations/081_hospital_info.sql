-- Hospital information: free general information, an estimate of the cases per procedure, and where people / departments are (rooms, floors).

alter table public.hospitals add column if not exists general_info text not null default '';

create table public.hospital_case_estimates (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  procedure_id uuid references public.procedures(id) on delete set null,
  -- a procedure that is not on the list of the system
  procedure_text text not null default '',
  cases integer not null default 0 check (cases >= 0),
  period text not null default 'year' check (period in ('year', 'month')),
  note text not null default '',
  updated_by uuid references public.profiles(id) on delete set null default public.effective_uid(),
  updated_at timestamptz not null default now()
);
create index hospital_case_estimates_hospital_idx on public.hospital_case_estimates (hospital_id);

create table public.hospital_locations (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  -- who or what: "מנהל מחלקה אורתופדית", "אחות אחראית", "חדר ניתוח 3"
  title text not null,
  person text not null default '',
  -- where: building, floor, room
  place text not null default '',
  note text not null default '',
  sort int not null default 0,
  updated_by uuid references public.profiles(id) on delete set null default public.effective_uid(),
  updated_at timestamptz not null default now()
);
create index hospital_locations_hospital_idx on public.hospital_locations (hospital_id, sort);

do $$
declare t text;
begin
  foreach t in array array['hospital_case_estimates', 'hospital_locations'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', t || '_all', t);
    execute format('create policy active_users_only on public.%I as restrictive for all to authenticated using ((select public.is_active())) with check ((select public.is_active()))', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()', 'audit_' || t, t);
  end loop;
end $$;
