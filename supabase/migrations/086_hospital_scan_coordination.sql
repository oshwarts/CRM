-- How the CT appointments of a hospital are coordinated (the contact itself is hospitals.scan_contact_id, migration 083).
-- Public hospital: the agent talks to the hospital's secretary. Private hospital: the agent hands the patient to the AMI
-- secretary (one for the whole system: app_settings key scan.ami_secretary), who coordinates with the imaging center.
alter table public.hospitals
  add column if not exists scan_center_name text not null default '',
  add column if not exists scan_hours text not null default '',
  add column if not exists scan_notes text not null default '',
  add column if not exists scan_phone text not null default '',
  add column if not exists scan_email text not null default '',
  add column if not exists scan_whatsapp_name text not null default '',
  add column if not exists scan_whatsapp_url text not null default '';
