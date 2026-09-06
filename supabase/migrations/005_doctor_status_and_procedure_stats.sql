alter table public.doctors
  add column status text not null default 'client' check (status in ('client','potential')),
  add column tracking_notes text not null default '';

create table public.doctor_procedure_stats (
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  procedure_id uuid not null references public.procedures(id) on delete cascade,
  volume integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (doctor_id, procedure_id)
);
create trigger dps_updated_at before update on public.doctor_procedure_stats
  for each row execute function public.set_updated_at();

create table public.hospital_procedure_stats (
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  procedure_id uuid not null references public.procedures(id) on delete cascade,
  volume integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (hospital_id, procedure_id)
);
create trigger hps_updated_at before update on public.hospital_procedure_stats
  for each row execute function public.set_updated_at();

alter table public.doctor_procedure_stats   enable row level security;
alter table public.hospital_procedure_stats enable row level security;
create policy "doctor_procedure_stats_all" on public.doctor_procedure_stats
  for all to authenticated using (true) with check (true);
create policy "hospital_procedure_stats_all" on public.hospital_procedure_stats
  for all to authenticated using (true) with check (true);

create index dps_procedure_idx on public.doctor_procedure_stats (procedure_id);
create index hps_procedure_idx on public.hospital_procedure_stats (procedure_id);
create index doctors_status_idx on public.doctors (status);
