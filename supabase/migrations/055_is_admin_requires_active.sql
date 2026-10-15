-- A deactivated manager kept the manager powers that do not go through table RLS (the restrictive "active users only"
-- policy blocks tables, but not SECURITY DEFINER functions or the admin-reset-link edge function, which only ask
-- is_admin()): merge_records, admin_user_activity, password-reset links ... An admin has to be an ACTIVE admin.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = public.effective_uid() and role = 'admin' and active);
$$;
