-- entry_date now means the surgery date; drop the 'in_progress' status; add
-- implant type / bearing options.

alter table public.patient_scans rename column entry_date to surgery_date;

alter table public.patient_scans drop constraint patient_scans_status_check;
update public.patient_scans set status = 'planned' where status = 'in_progress';
alter table public.patient_scans add constraint patient_scans_status_check
  check (status in ('planned','done','cancelled'));

insert into public.implant_options (category, value, sort) values
  ('knee_type','CR',1),('knee_type','CS',2),('knee_type','PS',3),('knee_type','TS',4),
  ('uni_type','Onlay',1),('uni_type','Inlay',2),
  ('hip_bearing','X3 PE',1),('hip_bearing','Dual Mobility',2),('hip_bearing','Ceramic-on-Ceramic',3)
on conflict do nothing;
