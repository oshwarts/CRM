-- Learning module v2: content editors with manager approval, lessons, clinical cases, images, spaced repetition,
-- learning tracks (paths) with pass marks, and automatic completion of a linked training stage.

/* ---------- content editors ---------- */
alter table public.profiles add column if not exists is_content_editor boolean not null default false;

create or replace function public.protect_developer_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      if new.is_developer or new.is_test or new.impersonating_id is not null or new.is_content_editor then
        raise exception 'not allowed';
      end if;
    elsif new.is_developer is distinct from old.is_developer
       or new.is_test is distinct from old.is_test
       or new.impersonating_id is distinct from old.impersonating_id then
      raise exception 'not allowed';
    elsif new.is_content_editor is distinct from old.is_content_editor and not public.is_admin() then
      raise exception 'only admins can change content editors';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.can_edit_learning()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (select 1 from public.profiles where id = public.effective_uid() and is_content_editor and active)
$$;
revoke all on function public.can_edit_learning() from public, anon;
grant execute on function public.can_edit_learning() to authenticated;

/* ---------- approval: what an editor writes waits for a manager ---------- */
alter table public.learn_cards add column if not exists image_path text;
alter table public.learn_cards add column if not exists approved boolean not null default true;

create table public.learn_lessons (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.learn_topics(id) on delete cascade,
  title text not null,
  body text not null default '',
  image_path text,
  video_url text not null default '',
  sort int not null default 0,
  approved boolean not null default true,
  created_at timestamptz not null default now()
);
create index learn_lessons_topic_idx on public.learn_lessons (topic_id, sort);

create table public.learn_cases (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.learn_topics(id) on delete cascade,
  title text not null,
  scenario text not null default '',
  image_path text,
  question text not null default '',
  options jsonb not null default '[]'::jsonb,
  correct_index int not null default 0,
  explanation text not null default '',
  sort int not null default 0,
  approved boolean not null default true,
  created_at timestamptz not null default now()
);
create index learn_cases_topic_idx on public.learn_cases (topic_id, sort);

create or replace function public.learn_moderate()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_admin() then new.approved := false; end if;
  return new;
end;
$$;
create trigger learn_cards_moderate before insert or update on public.learn_cards for each row execute function public.learn_moderate();
create trigger learn_lessons_moderate before insert or update on public.learn_lessons for each row execute function public.learn_moderate();
create trigger learn_cases_moderate before insert or update on public.learn_cases for each row execute function public.learn_moderate();

alter table public.learn_lessons enable row level security;
alter table public.learn_cases enable row level security;

drop policy learn_topics_admin on public.learn_topics;
create policy learn_topics_edit on public.learn_topics for all to authenticated using (public.can_edit_learning()) with check (public.can_edit_learning());
drop policy learn_cards_read on public.learn_cards;
drop policy learn_cards_admin on public.learn_cards;
create policy learn_cards_read on public.learn_cards for select to authenticated using (approved or public.can_edit_learning());
create policy learn_cards_edit on public.learn_cards for all to authenticated using (public.can_edit_learning()) with check (public.can_edit_learning());

create policy learn_lessons_read on public.learn_lessons for select to authenticated using (approved or public.can_edit_learning());
create policy learn_lessons_edit on public.learn_lessons for all to authenticated using (public.can_edit_learning()) with check (public.can_edit_learning());
create policy learn_cases_read on public.learn_cases for select to authenticated using (approved or public.can_edit_learning());
create policy learn_cases_edit on public.learn_cases for all to authenticated using (public.can_edit_learning()) with check (public.can_edit_learning());

do $$
declare t text;
begin
  foreach t in array array['learn_lessons', 'learn_cases'] loop
    execute format('create policy active_users_only on public.%I as restrictive for all to authenticated using ((select public.is_active())) with check ((select public.is_active()))', t);
  end loop;
end $$;

/* ---------- spaced repetition (Leitner boxes) ---------- */
alter table public.learn_progress add column if not exists box int not null default 0;
alter table public.learn_progress add column if not exists due_on date not null default current_date;
create index if not exists learn_progress_due_idx on public.learn_progress (user_id, due_on);
-- cards already marked as known start in box 2 and come back in 3 days
update public.learn_progress set box = 2, due_on = current_date + 3 where known;

/* ---------- tracks: an ordered path of topics, each with a pass mark ---------- */
create table public.learn_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  audience text not null default 'all' check (audience in ('new', 'veteran', 'all')),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create table public.learn_track_items (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.learn_tracks(id) on delete cascade,
  topic_id uuid not null references public.learn_topics(id) on delete cascade,
  sort int not null default 0,
  pass_pct int not null default 80 check (pass_pct between 1 and 100),
  -- passing the topic's quiz completes this training stage for the user
  stage_id uuid references public.training_stages(id) on delete set null,
  unique (track_id, topic_id)
);
create index learn_track_items_track_idx on public.learn_track_items (track_id, sort);

alter table public.learn_tracks enable row level security;
alter table public.learn_track_items enable row level security;
create policy learn_tracks_read on public.learn_tracks for select to authenticated using (true);
create policy learn_tracks_admin on public.learn_tracks for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy learn_track_items_read on public.learn_track_items for select to authenticated using (true);
create policy learn_track_items_admin on public.learn_track_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
do $$
declare t text;
begin
  foreach t in array array['learn_tracks', 'learn_track_items'] loop
    execute format('create policy active_users_only on public.%I as restrictive for all to authenticated using ((select public.is_active())) with check ((select public.is_active()))', t);
  end loop;
end $$;
create trigger audit_learn_tracks after insert or update or delete on public.learn_tracks
  for each row execute function public.audit_row();

/* ---------- passing a topic completes the linked training stage ---------- */
create or replace function public.sync_learning_stages()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.effective_uid();
  r record;
  n int := 0;
begin
  if me is null then return 0; end if;
  for r in
    select ti.stage_id, ti.topic_id, ti.pass_pct,
           (select max(round(100.0 * a.score / nullif(a.total, 0))) from public.learn_attempts a where a.user_id = me and a.topic_id = ti.topic_id) as best
    from public.learn_track_items ti
    where ti.stage_id is not null
  loop
    if r.best is not null and r.best >= r.pass_pct
       and not exists (select 1 from public.agent_training t where t.agent_id = me and t.stage_id = r.stage_id) then
      insert into public.agent_training (agent_id, stage_id, completed_on, notes, created_by)
      values (me, r.stage_id, current_date, 'הושלם אוטומטית: עבר את מבחן הלומדה בציון ' || r.best || '%', me);
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;
revoke all on function public.sync_learning_stages() from public, anon;
grant execute on function public.sync_learning_stages() to authenticated;

-- starting tracks
insert into public.learn_tracks (title, description, audience, sort) values
  ('סוכן חדש', 'מסלול ההכשרה של סוכן חדש, צעד אחרי צעד', 'new', 0),
  ('העמקה וריענון', 'לסוכנים ותיקים', 'veteran', 1);
