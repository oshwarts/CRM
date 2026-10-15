-- daily learning activity (points, answers) per user: feeds the streak, points and badges
create table public.learn_daily (
  user_id uuid not null references public.profiles(id) on delete cascade default public.effective_uid(),
  day date not null default current_date,
  points int not null default 0,
  answers int not null default 0,
  correct int not null default 0,
  primary key (user_id, day)
);
alter table public.learn_daily enable row level security;
create policy learn_daily_own on public.learn_daily for all to authenticated
  using (user_id = public.effective_uid()) with check (user_id = public.effective_uid());
create policy learn_daily_admin_read on public.learn_daily for select to authenticated using (public.is_admin());
create policy active_users_only on public.learn_daily as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

-- adds to today's row atomically
create or replace function public.learn_add_points(p_points int, p_answers int, p_correct int)
returns void
language sql
set search_path = public
as $$
  insert into public.learn_daily (user_id, day, points, answers, correct)
  values (public.effective_uid(), current_date, greatest(p_points, 0), greatest(p_answers, 0), greatest(p_correct, 0))
  on conflict (user_id, day) do update
    set points = learn_daily.points + excluded.points,
        answers = learn_daily.answers + excluded.answers,
        correct = learn_daily.correct + excluded.correct
$$;
revoke all on function public.learn_add_points(int, int, int) from public, anon;
grant execute on function public.learn_add_points(int, int, int) to authenticated;

-- "put the steps in the right order": a titled list of steps, written by editors, approved by a manager
create table public.learn_sequences (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.learn_topics(id) on delete cascade,
  title text not null,
  steps text[] not null default '{}',
  sort int not null default 0,
  approved boolean not null default true,
  created_at timestamptz not null default now()
);
create index learn_sequences_topic_idx on public.learn_sequences (topic_id, sort);
alter table public.learn_sequences enable row level security;
create policy learn_sequences_read on public.learn_sequences for select to authenticated using (approved or public.can_edit_learning());
create policy learn_sequences_edit on public.learn_sequences for all to authenticated using (public.can_edit_learning()) with check (public.can_edit_learning());
create policy active_users_only on public.learn_sequences as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));
create trigger learn_sequences_moderate before insert or update on public.learn_sequences for each row execute function public.learn_moderate();
