-- ===== hospital organizations =====
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);
alter table public.hospitals
  add column organization_id uuid references public.organizations(id) on delete set null;

-- ===== robotic systems =====
create table public.robotic_systems (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);
create table public.hospital_robotic_systems (
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  system_id uuid not null references public.robotic_systems(id) on delete cascade,
  primary key (hospital_id, system_id)
);
create table public.doctor_robotic_systems (
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  system_id uuid not null references public.robotic_systems(id) on delete cascade,
  primary key (doctor_id, system_id)
);

-- ===== doctor pipeline fields =====
alter table public.doctors
  add column pipeline_stage text not null default '',
  add column next_step_date date;

-- ===== RLS =====
alter table public.organizations            enable row level security;
alter table public.robotic_systems          enable row level security;
alter table public.hospital_robotic_systems enable row level security;
alter table public.doctor_robotic_systems   enable row level security;
create policy "organizations_all" on public.organizations
  for all to authenticated using (true) with check (true);
create policy "robotic_systems_all" on public.robotic_systems
  for all to authenticated using (true) with check (true);
create policy "hospital_robotic_systems_all" on public.hospital_robotic_systems
  for all to authenticated using (true) with check (true);
create policy "doctor_robotic_systems_all" on public.doctor_robotic_systems
  for all to authenticated using (true) with check (true);

create index hrs_system_idx on public.hospital_robotic_systems (system_id);
create index drs_system_idx on public.doctor_robotic_systems (system_id);
create index hospitals_org_idx on public.hospitals (organization_id);

-- ===== seed =====
insert into public.organizations (name) values
  ('כללית'), ('ממשלתי'), ('פרטי'), ('מדיקה')
on conflict (name) do nothing;

insert into public.robotic_systems (name) values
  ('MAKO'), ('VELYS (ואליס)'), ('OMNIBotics (אומני)'), ('ROSA (רוזה)')
on conflict (name) do nothing;

-- best-effort organization mapping for known hospitals
update public.hospitals set organization_id = (select id from public.organizations where name = 'כללית')
  where name in ('בילינסון – מרכז רפואי רבין','שניידר לילדים','מאיר','קפלן','סורוקה','העמק','כרמל','יוספטל');
update public.hospitals set organization_id = (select id from public.organizations where name = 'ממשלתי')
  where name in ('שיבא – תל השומר','רמב"ם','וולפסון','שמיר – אסף הרופא','ברזילי','הלל יפה','בני ציון','מרכז רפואי לגליל','זיו','פוריה – ברוך פדה','איכילוב – סוראסקי');
update public.hospitals set organization_id = (select id from public.organizations where name = 'מדיקה')
  where name in ('רפאל מדיקל סנטר','אלישע');
update public.hospitals set organization_id = (select id from public.organizations where name = 'פרטי')
  where name like 'אסותא%' or name in ('הרצליה מדיקל סנטר','מרכז רפואי רמת אביב','מדיקל סנטר – רעננה');
