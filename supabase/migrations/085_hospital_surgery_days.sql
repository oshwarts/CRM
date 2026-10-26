-- The days of the week on which a hospital operates (0 = Sunday … 6 = Saturday), chosen on the hospital page
alter table public.hospitals add column if not exists surgery_days smallint[] not null default '{}';
