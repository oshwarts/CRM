alter table public.patient_scans
  add column plan_ready boolean not null default false,
  add column rescan boolean not null default false,
  add column rescan_date date,
  add column rescan_reason text not null default '',
  add column rescan_done boolean not null default false;
