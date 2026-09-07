-- Managed equipment catalog + per-doctor, per-procedure equipment lists.
-- Each line has qty-per-case and a flag: scales_with_cases (implants / disposables)
-- vs fixed quantity (instrument trays).

create table public.equipment_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  catalog_number text not null default '',
  company_id uuid references public.companies(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (name, catalog_number)
);

create table public.doctor_procedure_equipment (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  procedure_id uuid not null references public.procedures(id) on delete cascade,
  item_id uuid not null references public.equipment_items(id) on delete cascade,
  qty_per_case integer not null default 1,
  scales_with_cases boolean not null default true,
  created_at timestamptz not null default now(),
  unique (doctor_id, procedure_id, item_id)
);

alter table public.equipment_items            enable row level security;
alter table public.doctor_procedure_equipment enable row level security;
create policy "equipment_items_all" on public.equipment_items
  for all to authenticated using (true) with check (true);
create policy "doctor_procedure_equipment_all" on public.doctor_procedure_equipment
  for all to authenticated using (true) with check (true);

create index dpe_doctor_idx on public.doctor_procedure_equipment (doctor_id);
create index dpe_procedure_idx on public.doctor_procedure_equipment (procedure_id);
create index dpe_item_idx on public.doctor_procedure_equipment (item_id);
create index equipment_items_company_idx on public.equipment_items (company_id);
