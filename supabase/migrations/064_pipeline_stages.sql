-- The funnel of potential doctors: the stages are a list the managers edit (they used to be fixed in the code), every
-- potential doctor has a stage and a next step, and every change of stage is recorded (how long in a stage, conversion).

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort integer not null default 0,
  /** reaching this stage means the doctor became a client */
  is_won boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index pipeline_stages_name_key on public.pipeline_stages (lower(btrim(name)));

alter table public.pipeline_stages enable row level security;
create policy pipeline_stages_read on public.pipeline_stages for select to authenticated using (true);
create policy pipeline_stages_admin_write on public.pipeline_stages for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy active_users_only on public.pipeline_stages as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));
create trigger audit_pipeline_stages after insert or update or delete on public.pipeline_stages
  for each row execute function public.audit_row();

insert into public.pipeline_stages (name, sort, is_won) values
  ('זיהוי ראשוני', 1, false),
  ('יצירת קשר', 2, false),
  ('פגישת היכרות', 3, false),
  ('הדגמת מוצר', 4, false),
  ('ניתוח ניסיון', 5, false),
  ('משא ומתן', 6, false),
  ('סגירה / הפיכה ללקוח', 7, true);

-- the next step as words, next to the date that already exists
alter table public.doctors add column next_step text not null default '';

-- history of the stage of every doctor
create table public.doctor_stage_history (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  stage text not null,
  previous_stage text not null default '',
  changed_at timestamptz not null default now(),
  changed_by uuid references public.profiles(id) on delete set null default public.effective_uid()
);
create index doctor_stage_history_doctor_idx on public.doctor_stage_history (doctor_id, changed_at desc);

alter table public.doctor_stage_history enable row level security;
create policy doctor_stage_history_read on public.doctor_stage_history for select to authenticated using (true);
create policy active_users_only on public.doctor_stage_history as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create or replace function public.doctors_stage_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('app.skip_stage_history', true), '') = '1' then return new; end if;
  if tg_op = 'INSERT' then
    if coalesce(new.pipeline_stage, '') <> '' then
      insert into public.doctor_stage_history (doctor_id, stage, previous_stage) values (new.id, new.pipeline_stage, '');
    end if;
  elsif new.pipeline_stage is distinct from old.pipeline_stage then
    insert into public.doctor_stage_history (doctor_id, stage, previous_stage) values (new.id, coalesce(new.pipeline_stage, ''), coalesce(old.pipeline_stage, ''));
  end if;
  return new;
end;
$$;
revoke execute on function public.doctors_stage_history() from public, anon, authenticated;
create trigger doctors_stage_history_trg after insert or update of pipeline_stage on public.doctors
  for each row execute function public.doctors_stage_history();

-- doctors that already have a stage: it counts from the last time the doctor was updated
insert into public.doctor_stage_history (doctor_id, stage, changed_at)
select id, pipeline_stage, coalesce(updated_at, created_at) from public.doctors where coalesce(pipeline_stage, '') <> '';

-- a manager renames a stage: the doctors and the history follow
create or replace function public.rename_pipeline_stage(p_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare old_name text; new_name text := btrim(p_name);
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if new_name = '' then raise exception 'empty name'; end if;
  select name into old_name from public.pipeline_stages where id = p_id;
  if old_name is null then raise exception 'no such stage'; end if;
  update public.pipeline_stages set name = new_name where id = p_id;
  update public.doctor_stage_history set stage = new_name where stage = old_name;
  update public.doctor_stage_history set previous_stage = new_name where previous_stage = old_name;
  -- the history trigger would log the rename as a move of every doctor: it is told to skip this update
  perform set_config('app.skip_stage_history', '1', true);
  update public.doctors set pipeline_stage = new_name where pipeline_stage = old_name;
  perform set_config('app.skip_stage_history', '', true);
end;
$$;

-- a manager deletes a stage: its doctors move to another stage (or to none)
create or replace function public.delete_pipeline_stage(p_id uuid, p_move_to text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare old_name text;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select name into old_name from public.pipeline_stages where id = p_id;
  if old_name is null then raise exception 'no such stage'; end if;
  update public.doctors set pipeline_stage = coalesce(p_move_to, '') where pipeline_stage = old_name;
  delete from public.pipeline_stages where id = p_id;
end;
$$;
