-- MAKO patient-scan tracking: one shared table across all MAKO hospitals, plus a
-- managed list of implant size options per procedure type.

create table public.implant_options (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  value text not null,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  unique (category, value)
);

create table public.patient_scans (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete restrict,
  entry_date date default current_date,
  patient_name text not null default '',
  patient_phone text not null default '',
  patient_id_number text not null default '',
  patient_dob date,
  health_fund text not null default '',
  insurance text not null default '',
  surgeon_id uuid references public.doctors(id) on delete set null,
  procedure_type text not null default 'knee' check (procedure_type in ('knee','uni','hip')),
  side text not null default '',
  ct_date date,
  ct_time time,
  anaesthesia_note text not null default '',
  scanned boolean not null default false,
  uploaded boolean not null default false,
  status text not null default 'planned' check (status in ('planned','in_progress','done','cancelled')),
  implant_data jsonb not null default '{}'::jsonb,
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger patient_scans_updated_at before update on public.patient_scans
  for each row execute function public.set_updated_at();

alter table public.implant_options enable row level security;
alter table public.patient_scans  enable row level security;
create policy "implant_options_all" on public.implant_options
  for all to authenticated using (true) with check (true);
create policy "patient_scans_all" on public.patient_scans
  for all to authenticated using (true) with check (true);

create index patient_scans_hospital_idx on public.patient_scans (hospital_id);
create index patient_scans_ct_idx on public.patient_scans (ct_date);
create index patient_scans_status_idx on public.patient_scans (status);
create index patient_scans_surgeon_idx on public.patient_scans (surgeon_id);
create index implant_options_category_idx on public.implant_options (category);

-- seed common Stryker sizes (editable in Settings)
insert into public.implant_options (category, value, sort) values
  ('knee_femur','1',1),('knee_femur','2',2),('knee_femur','3',3),('knee_femur','4',4),
  ('knee_femur','5',5),('knee_femur','6',6),('knee_femur','7',7),('knee_femur','8',8),
  ('knee_tibia','1',1),('knee_tibia','2',2),('knee_tibia','3',3),('knee_tibia','4',4),
  ('knee_tibia','5',5),('knee_tibia','6',6),('knee_tibia','7',7),('knee_tibia','8',8),
  ('knee_insert','9',9),('knee_insert','11',11),('knee_insert','13',13),
  ('knee_insert','16',16),('knee_insert','19',19),('knee_insert','22',22),('knee_insert','25',25),
  ('uni_femur','1',1),('uni_femur','2',2),('uni_femur','3',3),('uni_femur','4',4),
  ('uni_femur','5',5),('uni_femur','6',6),('uni_femur','7',7),
  ('uni_tibia','1',1),('uni_tibia','2',2),('uni_tibia','3',3),('uni_tibia','4',4),
  ('uni_tibia','5',5),('uni_tibia','6',6),('uni_tibia','7',7),
  ('uni_insert','8',8),('uni_insert','9',9),('uni_insert','10',10),('uni_insert','11',11),('uni_insert','12',12),
  ('uni_side','מדיאלי',1),('uni_side','לטרלי',2),
  ('hip_cup','44',44),('hip_cup','46',46),('hip_cup','48',48),('hip_cup','50',50),
  ('hip_cup','52',52),('hip_cup','54',54),('hip_cup','56',56),('hip_cup','58',58),
  ('hip_cup','60',60),('hip_cup','62',62),('hip_cup','64',64),('hip_cup','66',66),
  ('hip_stem','0',0),('hip_stem','1',1),('hip_stem','2',2),('hip_stem','3',3),('hip_stem','4',4),
  ('hip_stem','5',5),('hip_stem','6',6),('hip_stem','7',7),('hip_stem','8',8),
  ('hip_head','28',28),('hip_head','32',32),('hip_head','36',36),('hip_head','40',40),
  ('hip_neck','-4',1),('hip_neck','0',2),('hip_neck','+4',3),('hip_neck','+8',4),('hip_neck','+12',5),
  ('mps','MPS -4',1),('mps','MPS 0',2),('mps','MPS +4',3),('mps','MPS +8',4)
on conflict do nothing;
