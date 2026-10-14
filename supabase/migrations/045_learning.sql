-- Learning module ("לומדה"): topics made of question/answer cards, studied as flashcards or as a multiple-choice quiz.
-- Managers write the content; everybody reads; progress is private to the user (managers read everybody's).

create table public.learn_topics (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.learn_cards (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.learn_topics(id) on delete cascade,
  question text not null,
  answer text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index learn_cards_topic_idx on public.learn_cards (topic_id, sort);

-- one row per user and card: is it known, and how often it was right / wrong
create table public.learn_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade default public.effective_uid(),
  card_id uuid not null references public.learn_cards(id) on delete cascade,
  topic_id uuid not null references public.learn_topics(id) on delete cascade,
  known boolean not null default false,
  correct_count int not null default 0,
  wrong_count int not null default 0,
  last_seen timestamptz not null default now(),
  unique (user_id, card_id)
);
create index learn_progress_user_idx on public.learn_progress (user_id, topic_id);

-- finished quizzes
create table public.learn_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade default public.effective_uid(),
  topic_id uuid not null references public.learn_topics(id) on delete cascade,
  score int not null,
  total int not null,
  taken_at timestamptz not null default now()
);
create index learn_attempts_user_idx on public.learn_attempts (user_id, taken_at desc);

alter table public.learn_topics enable row level security;
alter table public.learn_cards enable row level security;
alter table public.learn_progress enable row level security;
alter table public.learn_attempts enable row level security;

create policy learn_topics_read on public.learn_topics for select to authenticated using (true);
create policy learn_topics_admin on public.learn_topics for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy learn_cards_read on public.learn_cards for select to authenticated using (true);
create policy learn_cards_admin on public.learn_cards for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy learn_progress_own on public.learn_progress for all to authenticated
  using (user_id = public.effective_uid()) with check (user_id = public.effective_uid());
create policy learn_progress_admin_read on public.learn_progress for select to authenticated using (public.is_admin());
create policy learn_attempts_own on public.learn_attempts for all to authenticated
  using (user_id = public.effective_uid()) with check (user_id = public.effective_uid());
create policy learn_attempts_admin_read on public.learn_attempts for select to authenticated using (public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['learn_topics', 'learn_cards', 'learn_progress', 'learn_attempts'] loop
    execute format('create policy active_users_only on public.%I as restrictive for all to authenticated using ((select public.is_active())) with check ((select public.is_active()))', t);
  end loop;
end $$;

create trigger audit_learn_topics after insert or update or delete on public.learn_topics
  for each row execute function public.audit_row();
-- (cards are not audited one by one: an import adds hundreds)

-- the JR101 topic is created empty; its cards are imported by the manager
insert into public.learn_topics (title, description, sort) values ('JR101', 'שאלות קליניות ותשובות', 0);
