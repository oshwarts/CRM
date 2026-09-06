-- Replaces doctor_procedure_stats / hospital_procedure_stats with a single
-- table where every case is attributed to a doctor at a hospital, so hospital
-- totals always reconcile with the sum of their doctors' cases.

drop table if exists public.doctor_procedure_stats;
drop table if exists public.hospital_procedure_stats;

create table public.case_volumes (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  procedure_id uuid not null references public.procedures(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  year integer not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint case_volumes_unique unique nulls not distinct
    (doctor_id, hospital_id, procedure_id, company_id, year)
);
create trigger case_volumes_updated_at before update on public.case_volumes
  for each row execute function public.set_updated_at();

alter table public.case_volumes enable row level security;
create policy "case_volumes_all" on public.case_volumes
  for all to authenticated using (true) with check (true);

create index case_volumes_doctor_idx on public.case_volumes (doctor_id);
create index case_volumes_hospital_idx on public.case_volumes (hospital_id);
create index case_volumes_year_idx on public.case_volumes (year);
