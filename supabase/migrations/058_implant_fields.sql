-- Implant sizes, fully editable. The fields shown in a scan (per procedure type) move from the code into a table, and an
-- option can belong to one option of another field: "when the head is 36, the neck can be 0 / +2.5 / +5; when it is 32:
-- 0 / +4 / -4". Options without a parent are the general list of the field (used when the chosen parent has no list of its own).
alter table public.implant_options
  add column if not exists parent_id uuid references public.implant_options (id) on delete cascade;
create index if not exists implant_options_parent_idx on public.implant_options (parent_id) where parent_id is not null;
-- a value is unique within its list: the general list of a field, or the list of one parent option
alter table public.implant_options drop constraint if exists implant_options_category_value_key;
create unique index if not exists implant_options_unique_value
  on public.implant_options (category, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), value);

create table if not exists public.implant_fields (
  id uuid primary key default gen_random_uuid(),
  procedure_type text not null,
  key text not null,
  label text not null,
  category text not null,
  -- the category of another field of the same procedure whose chosen value narrows the options of this one
  depends_on text,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  unique (procedure_type, key)
);
alter table public.implant_fields enable row level security;
create policy active_users_only on public.implant_fields as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));
create policy implant_fields_read on public.implant_fields for select to authenticated using (true);
create policy implant_fields_write on public.implant_fields for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create trigger audit_implant_fields after insert or update or delete on public.implant_fields for each row execute function public.audit_row();

insert into public.implant_fields (procedure_type, key, label, category, depends_on, sort) values
  ('knee', 'type', 'סוג (CR/CS/PS)', 'knee_type', null, 1),
  ('knee', 'femur', 'Femur', 'knee_femur', null, 2),
  ('knee', 'tibia', 'Tibia', 'knee_tibia', null, 3),
  ('knee', 'insert', 'Insert', 'knee_insert', null, 4),
  ('uni', 'type', 'סוג (Onlay/Inlay)', 'uni_type', null, 1),
  ('uni', 'uni_femur', 'UNI Femur', 'uni_femur', null, 2),
  ('uni', 'uni_tibia', 'UNI Tibia', 'uni_tibia', null, 3),
  ('uni', 'uni_insert', 'Insert', 'uni_insert', null, 4),
  ('uni', 'uni_side', 'צד', 'uni_side', null, 5),
  ('hip', 'bearing', 'משטח נשיאה', 'hip_bearing', null, 1),
  ('hip', 'cup', 'Cup', 'hip_cup', null, 2),
  ('hip', 'stem', 'Stem', 'hip_stem', null, 3),
  ('hip', 'head', 'Head', 'hip_head', null, 4),
  ('hip', 'neck', 'Neck', 'hip_neck', 'hip_head', 5),
  ('hip', 'mps', 'MPS', 'mps', null, 6)
on conflict (procedure_type, key) do nothing;

-- the options had no order: keep the order they have now (by value, numbers as numbers), then it can be changed by hand
with ranked as (
  select id, row_number() over (partition by category order by
    case when value ~ '^[+-]?[0-9]+([.][0-9]+)?$' then value::numeric end, value) as r
  from public.implant_options where parent_id is null
)
update public.implant_options o set sort = ranked.r from ranked where o.id = ranked.id;

-- the example of the manager: neck options by head size
do $$
declare h36 uuid; h32 uuid;
begin
  select id into h36 from public.implant_options where category = 'hip_head' and value = '36' limit 1;
  select id into h32 from public.implant_options where category = 'hip_head' and value = '32' limit 1;
  if h36 is not null and not exists (select 1 from public.implant_options where parent_id = h36) then
    insert into public.implant_options (category, value, sort, parent_id) values
      ('hip_neck', '0', 1, h36), ('hip_neck', '+2.5', 2, h36), ('hip_neck', '+5', 3, h36);
  end if;
  if h32 is not null and not exists (select 1 from public.implant_options where parent_id = h32) then
    insert into public.implant_options (category, value, sort, parent_id) values
      ('hip_neck', '0', 1, h32), ('hip_neck', '4', 2, h32), ('hip_neck', '-4', 3, h32);
  end if;
end $$;
