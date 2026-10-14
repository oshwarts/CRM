-- "my profile" edits follow the effective user (the developer switched to someone edits that user's profile)
alter policy profiles_update_self on public.profiles
  using (id = public.effective_uid() or public.is_admin())
  with check (id = public.effective_uid() or public.is_admin());
