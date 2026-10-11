-- MAKO consumables stock counts per hospital.
--   consumable_items    : catalog (with a default minimum per item)
--   consumable_minimums : optional per-hospital override of the minimum
--   consumable_counts   : one row per count (hospital, date, who counted)
--   consumable_count_lines : counted qty per item, with the minimum frozen at count time
--   app_settings        : small key/value store (e.g. the e-mail that receives shortage lists)

create table public.consumable_items (
  id uuid primary key default gen_random_uuid(),
  category text not null default '',
  catalog_number text not null default '',
  name text not null,
  default_min integer not null default 0 check (default_min >= 0),
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index consumable_items_catalog_uidx
  on public.consumable_items (catalog_number) where catalog_number <> '';

create table public.consumable_minimums (
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  item_id uuid not null references public.consumable_items(id) on delete cascade,
  min_qty integer not null check (min_qty >= 0),
  primary key (hospital_id, item_id)
);

create table public.consumable_counts (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  counted_on date not null default current_date,
  counted_by uuid references public.profiles(id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index consumable_counts_hospital_idx
  on public.consumable_counts (hospital_id, counted_on desc);

create table public.consumable_count_lines (
  count_id uuid not null references public.consumable_counts(id) on delete cascade,
  item_id uuid not null references public.consumable_items(id) on delete cascade,
  qty integer not null default 0 check (qty >= 0),
  min_qty integer not null default 0 check (min_qty >= 0),
  primary key (count_id, item_id)
);

create table public.app_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.consumable_items       enable row level security;
alter table public.consumable_minimums    enable row level security;
alter table public.consumable_counts      enable row level security;
alter table public.consumable_count_lines enable row level security;
alter table public.app_settings           enable row level security;

create policy "consumable_items_all" on public.consumable_items
  for all to authenticated using (true) with check (true);
create policy "consumable_minimums_all" on public.consumable_minimums
  for all to authenticated using (true) with check (true);
create policy "consumable_counts_all" on public.consumable_counts
  for all to authenticated using (true) with check (true);
create policy "consumable_count_lines_all" on public.consumable_count_lines
  for all to authenticated using (true) with check (true);
create policy "app_settings_read" on public.app_settings
  for select to authenticated using (true);
create policy "app_settings_admin_write" on public.app_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.consumable_items (category, catalog_number, name, default_min, sort) values
  ('General',    '107120',     'VIZADISC™ KNEE PROCEDURE TRACKING KIT', 10, 1),
  ('General',    '111320',     'RIO® DRAPE KIT, ONE PIECE WITH POCKETS', 10, 2),
  ('KNEE',       '116170',     'MICS STAND. SAW BLADE, STERILE TRIATHLON SIZES 3-8', 10, 3),
  ('KNEE',       '111645',     'CHECKPOINT KIT, STERILE', 7, 4),
  ('KNEE',       '144110',     'BONE PIN, 4MM X 110MM, STERILE 2 PACK', 7, 5),
  ('KNEE',       '144140',     'BONE PIN, 4MM X 140MM, STERILE 2 PACK', 7, 6),
  ('UNI',        '111613',     'RIO® SYSTEM IRRIGATION TUBE', 5, 7),
  ('UNI',        '110135',     'MICS BALL BURR', 5, 8),
  ('UNI',        '111331',     'MICS IRRIGATION CLIP, STERILE', 5, 9),
  ('UNI',        '116171',     'MAKO SAGITTAL BLADE NARROW (TRIATHLON SIZES 1&2)', 7, 10),
  ('HIP',        '111653',     'CHECKPOINT, 3.5MM HEX, IMPACTION, STERILE', 7, 11),
  ('HIP',        '144170',     'BONE PIN, 4MM X 170MM, STERILE 2 PACK', 7, 12),
  ('HIP',        '111651',     'Tibial CHECKPOINT-3.5MM HEX X 15MM-STERILE', 7, 13),
  ('Leg Holder', '111619',     'silicone retractor cord', 1, 14),
  ('Leg Holder', '111618',     'Leg positioner disposables kit', 5, 15),
  ('Leg Holder', '803-GP-10',  'sterile patient protective pad for de Mayo knee positioners', 0, 16);
