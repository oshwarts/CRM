alter table public.patient_scans
  add column disk_collected boolean not null default false;
