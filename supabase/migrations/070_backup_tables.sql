-- The list of tables for the manual backup comes from the database itself, so that a table added later is never left out.
create or replace function public.backup_tables()
returns text[]
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return array(select tablename::text from pg_tables where schemaname = 'public' order by tablename);
end;
$$;
revoke all on function public.backup_tables() from public, anon;
grant execute on function public.backup_tables() to authenticated;
