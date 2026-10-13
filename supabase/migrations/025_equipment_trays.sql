-- Equipment for surgery: each catalog item (usually an instrument tray) gets a picture and the list of
-- parts (catalog numbers) that are inside it. Pictures live in the existing private bucket under "equipment/".

alter table public.equipment_items add column image_path text not null default '';

create table public.equipment_item_parts (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.equipment_items(id) on delete cascade,
  position int,
  catalog_no text not null default '',
  description text not null default '',
  qty int not null default 1 check (qty > 0),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index equipment_item_parts_item_idx on public.equipment_item_parts (item_id, sort);

alter table public.equipment_item_parts enable row level security;
create policy equipment_item_parts_all on public.equipment_item_parts for all to authenticated using (true) with check (true);
create policy active_users_only on public.equipment_item_parts as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));
