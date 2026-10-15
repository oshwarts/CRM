-- Quiz results are graded by the server. Until now a user wrote the score of an attempt himself (learn_attempts_own allowed
-- inserts), so anybody could record 100% and complete a training stage (sync_learning_stages reads these attempts).
-- Now the client sends the answers it picked; the server compares them with the cards and writes the attempt itself.
create or replace function public.learn_submit_attempt(p_topic uuid, p_picks jsonb)
returns table (o_score int, o_total int)
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.effective_uid();
  sc int := 0;
  tot int := 0;
  need int;
  r record;
begin
  if me is null or not public.is_active() then raise exception 'not allowed'; end if;
  if p_picks is null or jsonb_typeof(p_picks) <> 'array' then raise exception 'bad answers'; end if;

  for r in
    select distinct on (p.card_id) p.card_id, p.answer as pick, c.answer as right_answer
    from jsonb_to_recordset(p_picks) as p(card_id uuid, answer text)
    join public.learn_cards c on c.id = p.card_id and c.topic_id = p_topic and (c.approved or public.can_edit_learning())
    order by p.card_id
  loop
    tot := tot + 1;
    if r.pick is not null and btrim(r.pick) = btrim(r.right_answer) then sc := sc + 1; end if;
  end loop;

  -- a "quiz" of one lucky question is not a result: at least 5 questions (or the whole topic when it is smaller)
  select least(5, count(*)) into need from public.learn_cards where topic_id = p_topic and (approved or public.can_edit_learning());
  if tot = 0 or tot < need then raise exception 'too few questions'; end if;

  insert into public.learn_attempts (user_id, topic_id, score, total) values (me, p_topic, sc, tot);
  return query select sc, tot;
end;
$$;
revoke all on function public.learn_submit_attempt(uuid, jsonb) from public, anon;
grant execute on function public.learn_submit_attempt(uuid, jsonb) to authenticated;

-- own attempts can only be read; the only way to add one is the function above
drop policy if exists learn_attempts_own on public.learn_attempts;
create policy learn_attempts_own_read on public.learn_attempts for select to authenticated using (user_id = public.effective_uid());

-- the test-user reset also clears what the fictitious user learned
create or replace function public.reset_test_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_real_developer() then raise exception 'not allowed'; end if;
  if not exists (select 1 from public.profiles where id = p_target and is_test) then
    raise exception 'not a test user';
  end if;
  delete from public.meeting_tasks where created_by = p_target or assignee_id = p_target;
  delete from public.project_updates where author_id = p_target;
  delete from public.projects where owner_id = p_target;
  delete from public.meetings where created_by = p_target;
  delete from public.patient_scans where created_by = p_target;
  delete from public.competitor_intel where created_by = p_target;
  delete from public.consumable_counts where counted_by = p_target;
  delete from public.agent_goals where created_by = p_target or agent_id = p_target;
  delete from public.agent_reviews where created_by = p_target or agent_id = p_target;
  delete from public.agent_notes where created_by = p_target or agent_id = p_target;
  delete from public.agent_training where created_by = p_target or agent_id = p_target;
  delete from public.learn_progress where user_id = p_target;
  delete from public.learn_attempts where user_id = p_target;
  delete from public.learn_daily where user_id = p_target;
  delete from public.favorites where user_id = p_target;
  delete from public.hospital_agents where agent_id = p_target;
  delete from public.doctors where created_by = p_target;
end;
$$;
