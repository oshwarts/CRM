-- Agent management (managers): personal goals (measured from the system or typed in), 1:1 / monthly / quarterly
-- reviews and free manager notes. Agents read only their own goals.

-- managers can read every agent's favorites (to measure contact cadence per agent)
create policy favorites_admin_read on public.favorites for select to authenticated using (public.is_admin());

create table public.agent_goals (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  category text not null default 'activity' check (category in ('activity', 'sales', 'development', 'personal')),
  -- 'manual' = a number the manager types in, 'text' = a free goal with a progress %, anything else = a metric measured from the system
  metric text not null default 'manual',
  target numeric,
  current_value numeric not null default 0,
  unit text not null default '',
  progress_pct int not null default 0 check (progress_pct between 0 and 100),
  period_start date not null,
  period_end date not null,
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index agent_goals_agent_idx on public.agent_goals (agent_id, period_start);
create trigger agent_goals_updated_at before update on public.agent_goals
  for each row execute function public.set_updated_at();

create table public.agent_reviews (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'one_on_one' check (kind in ('one_on_one', 'monthly', 'quarterly')),
  review_date date not null default current_date,
  summary text not null default '',
  agreements text not null default '',
  rating int check (rating between 1 and 5),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index agent_reviews_agent_idx on public.agent_reviews (agent_id, review_date desc);
create trigger agent_reviews_updated_at before update on public.agent_reviews
  for each row execute function public.set_updated_at();

create table public.agent_notes (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  note_date date not null default current_date,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index agent_notes_agent_idx on public.agent_notes (agent_id, note_date desc);

-- tasks that come out of a 1:1 meeting remember which one
alter table public.meeting_tasks add column review_id uuid references public.agent_reviews(id) on delete set null;

alter table public.agent_goals enable row level security;
alter table public.agent_reviews enable row level security;
alter table public.agent_notes enable row level security;

-- goals: managers manage everything, an agent only reads his own; reviews and manager notes are for managers only
create policy agent_goals_admin on public.agent_goals for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy agent_goals_own_read on public.agent_goals for select to authenticated using (agent_id = auth.uid());
create policy agent_reviews_admin on public.agent_reviews for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy agent_notes_admin on public.agent_notes for all to authenticated using (public.is_admin()) with check (public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['agent_goals', 'agent_reviews', 'agent_notes'] loop
    execute format('create policy active_users_only on public.%I as restrictive for all to authenticated using ((select public.is_active())) with check ((select public.is_active()))', t);
  end loop;
end $$;

create trigger audit_agent_goals after insert or update or delete on public.agent_goals
  for each row execute function public.audit_row();
