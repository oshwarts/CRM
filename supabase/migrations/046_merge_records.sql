-- Manager-only merge of two duplicate records (doctors, contacts, hospitals): empty text fields of the kept record are
-- filled from the other one, every reference to the other record is moved to the kept one (a row that would become a
-- duplicate of an existing one is dropped), then the other record is deleted.
create or replace function public.merge_records(p_table text, p_keep uuid, p_drop uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fk record;
  r record;
  rid tid;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if p_table not in ('doctors', 'contacts', 'hospitals') then raise exception 'unsupported table'; end if;
  if p_keep = p_drop then raise exception 'same record'; end if;

  -- 1. blanks of the kept record are filled from the other one
  for r in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = p_table and data_type = 'text' and column_name <> 'id'
  loop
    execute format(
      'update public.%1$I k set %2$I = d.%2$I from public.%1$I d where k.id = $1 and d.id = $2 and coalesce(k.%2$I, '''') = '''' and coalesce(d.%2$I, '''') <> ''''',
      p_table, r.column_name) using p_keep, p_drop;
  end loop;

  -- 2. every single-column reference moves to the kept record
  for fk in
    select c.conrelid::regclass::text as tbl, a.attname::text as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.contype = 'f' and c.confrelid = ('public.' || p_table)::regclass and array_length(c.conkey, 1) = 1
  loop
    begin
      execute format('update %s set %I = $1 where %I = $2', fk.tbl, fk.col, fk.col) using p_keep, p_drop;
    exception when unique_violation then
      -- some rows would duplicate an existing one: move them one by one and drop the ones that cannot move
      for rid in execute format('select ctid from %s where %I = $1', fk.tbl, fk.col) using p_drop loop
        begin
          execute format('update %s set %I = $1 where ctid = $2', fk.tbl, fk.col) using p_keep, rid;
        exception when unique_violation then
          execute format('delete from %s where ctid = $1', fk.tbl) using rid;
        end;
      end loop;
    end;
  end loop;

  execute format('delete from public.%I where id = $1', p_table) using p_drop;
end;
$$;
revoke all on function public.merge_records(text, uuid, uuid) from public, anon;
grant execute on function public.merge_records(text, uuid, uuid) to authenticated;
