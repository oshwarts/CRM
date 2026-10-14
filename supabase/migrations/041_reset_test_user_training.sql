-- reset_test_user also clears the training rows of the test user
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
  delete from public.favorites where user_id = p_target;
  delete from public.hospital_agents where agent_id = p_target;
  delete from public.doctors where created_by = p_target;
end;
$$;
