create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default '',
  phone text not null default '',
  email text not null default '',
  notes text not null default '',
  hospital_id uuid references public.hospitals(id) on delete set null,
  doctor_id uuid references public.doctors(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger contacts_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();

alter table public.contacts enable row level security;
create policy "contacts_all" on public.contacts
  for all to authenticated using (true) with check (true);

create index contacts_hospital_idx on public.contacts (hospital_id);
create index contacts_doctor_idx on public.contacts (doctor_id);
