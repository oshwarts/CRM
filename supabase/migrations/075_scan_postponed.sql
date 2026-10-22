-- A surgery can be postponed (no new date yet) as well as planned / done / cancelled.
alter table public.patient_scans drop constraint patient_scans_status_check;
alter table public.patient_scans add constraint patient_scans_status_check
  check (status in ('planned', 'done', 'cancelled', 'postponed'));
