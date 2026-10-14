-- the parts list of an equipment tray is replaced in ONE transaction: if the insert fails the old list stays
create or replace function public.replace_equipment_parts(p_item uuid, p_parts jsonb)
returns void
language plpgsql
set search_path = public
as $$
begin
  delete from public.equipment_item_parts where item_id = p_item;
  insert into public.equipment_item_parts (item_id, position, catalog_no, description, qty, sort)
  select p_item, x.position, coalesce(x.catalog_no, ''), coalesce(x.description, ''), greatest(1, coalesce(x.qty, 1)), coalesce(x.sort, 0)
  from jsonb_to_recordset(coalesce(p_parts, '[]'::jsonb)) as x(position int, catalog_no text, description text, qty int, sort int);
end;
$$;
revoke all on function public.replace_equipment_parts(uuid, jsonb) from public, anon;
grant execute on function public.replace_equipment_parts(uuid, jsonb) to authenticated;
