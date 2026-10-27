-- Closing a week: once a manager closes it, it becomes the published roster — agents can no longer change their own
-- availability for it (a manager always can, and may keep adjusting assignments after the close). Each close, and each
-- assignment change made after a close, drops a personal notification for the agent it concerns.

create or replace function public.week_start_of(d date)
returns date language sql immutable as $$
  select d - extract(dow from d)::int
$$;

create table public.roster_weeks (
  week_start date primary key,
  closed_at timestamptz not null default now(),
  closed_by uuid references public.profiles(id) on delete set null default public.effective_uid()
);

create or replace function public.is_week_closed(d date)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.roster_weeks w where w.week_start = public.week_start_of(d));
$$;
revoke all on function public.is_week_closed(date) from public, anon;
grant execute on function public.is_week_closed(date) to authenticated;

alter table public.roster_weeks enable row level security;
create policy roster_weeks_read on public.roster_weeks for select to authenticated using (true);
create policy roster_weeks_write on public.roster_weeks for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy active_users_only on public.roster_weeks as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));
create trigger audit_roster_weeks after insert or update or delete on public.roster_weeks
  for each row execute function public.audit_row();

-- a closed week blocks an agent's own edits to their availability; a manager is never blocked by it
create policy roster_week_open on public.agent_availability as restrictive for all to authenticated
  using (public.is_admin() or not public.is_week_closed(date))
  with check (public.is_admin() or not public.is_week_closed(date));

create table public.roster_notifications (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  kind text not null check (kind in ('week_closed', 'assignment_changed')),
  message text not null default '',
  date date,
  shift text check (shift in ('morning', 'evening')),
  created_by uuid references public.profiles(id) on delete set null default public.effective_uid(),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index roster_notifications_agent_idx on public.roster_notifications (agent_id, read_at);

alter table public.roster_notifications enable row level security;
create policy roster_notifications_read on public.roster_notifications
  for select to authenticated using (agent_id = public.effective_uid() or public.is_admin());
create policy roster_notifications_insert on public.roster_notifications
  for insert to authenticated with check (public.is_admin());
create policy roster_notifications_mark_read on public.roster_notifications
  for update to authenticated using (agent_id = public.effective_uid()) with check (agent_id = public.effective_uid());
create policy active_users_only on public.roster_notifications as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));
