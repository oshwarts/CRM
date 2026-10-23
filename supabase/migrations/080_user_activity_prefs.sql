-- What each user has seen of "what is going on in the department" and which kinds of news he wants counted: kept per user (not per device).
create table public.user_activity_prefs (
  user_id uuid primary key references public.profiles(id) on delete cascade default public.effective_uid(),
  seen_at timestamptz,
  kinds text[],
  updated_at timestamptz not null default now()
);
alter table public.user_activity_prefs enable row level security;
create policy user_activity_prefs_own on public.user_activity_prefs for all to authenticated
  using (user_id = public.effective_uid()) with check (user_id = public.effective_uid());
create policy active_users_only on public.user_activity_prefs as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));
