-- how many units of each consumable one surgery of a type uses (knee / uni / hip) — the basis of the stock forecast
create table public.consumable_usage (
  item_id uuid not null references public.consumable_items(id) on delete cascade,
  procedure_type text not null check (procedure_type in ('knee', 'uni', 'hip')),
  qty_per_case numeric not null default 0 check (qty_per_case >= 0),
  primary key (item_id, procedure_type)
);
alter table public.consumable_usage enable row level security;
create policy consumable_usage_read on public.consumable_usage for select to authenticated using (true);
create policy consumable_usage_admin on public.consumable_usage for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy active_users_only on public.consumable_usage as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));
create trigger audit_consumable_usage after insert or update or delete on public.consumable_usage
  for each row execute function public.audit_row();
