-- Efficiency and availability: indexes for the foreign keys, automatic clean-up of old logs, live updates, an error log of the
-- app, and a health summary for the managers.

-- 1. indexes for foreign keys that had none (joins and deletes of the parent rows stay fast as the tables grow)
create index if not exists agent_goals_created_by_idx on public.agent_goals (created_by);
create index if not exists agent_notes_created_by_idx on public.agent_notes (created_by);
create index if not exists agent_reviews_created_by_idx on public.agent_reviews (created_by);
create index if not exists agent_training_created_by_idx on public.agent_training (created_by);
create index if not exists agent_training_stage_idx on public.agent_training (stage_id);
create index if not exists case_volumes_company_idx on public.case_volumes (company_id);
create index if not exists case_volumes_procedure_idx on public.case_volumes (procedure_id);
create index if not exists competitor_intel_created_by_idx on public.competitor_intel (created_by);
create index if not exists consumable_count_lines_item_idx on public.consumable_count_lines (item_id);
create index if not exists consumable_counts_counted_by_idx on public.consumable_counts (counted_by);
create index if not exists consumable_minimums_item_idx on public.consumable_minimums (item_id);
create index if not exists doctor_preop_plans_procedure_idx on public.doctor_preop_plans (procedure_id);
create index if not exists doctor_stage_history_changed_by_idx on public.doctor_stage_history (changed_by);
create index if not exists doctor_surgical_courses_procedure_idx on public.doctor_surgical_courses (procedure_id);
create index if not exists favorites_doctor_idx on public.favorites (doctor_id);
create index if not exists info_document_procedures_procedure_idx on public.info_document_procedures (procedure_id);
create index if not exists info_documents_uploaded_by_idx on public.info_documents (uploaded_by);
create index if not exists learn_attempts_topic_idx on public.learn_attempts (topic_id);
create index if not exists learn_progress_card_idx on public.learn_progress (card_id);
create index if not exists learn_progress_topic_idx on public.learn_progress (topic_id);
create index if not exists learn_track_items_stage_idx on public.learn_track_items (stage_id);
create index if not exists learn_track_items_topic_idx on public.learn_track_items (topic_id);
create index if not exists meeting_tasks_area_idx on public.meeting_tasks (area_id);
create index if not exists meeting_tasks_review_idx on public.meeting_tasks (review_id);
create index if not exists planned_surgeries_created_by_idx on public.planned_surgeries (created_by);
create index if not exists profiles_impersonating_idx on public.profiles (impersonating_id);
create index if not exists profiles_status_changed_by_idx on public.profiles (status_changed_by);
create index if not exists project_areas_contact_idx on public.project_areas (contact_id);
create index if not exists project_files_task_idx on public.project_files (task_id);
create index if not exists project_files_update_idx on public.project_files (update_id);
create index if not exists project_files_uploaded_by_idx on public.project_files (uploaded_by);
create index if not exists project_updates_task_idx on public.project_updates (task_id);

-- 2. an error log of the app: what failed on somebody's screen (everybody can add a line, only managers read)
create table public.client_errors (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  message text not null default '',
  url text not null default '',
  stack text not null default '',
  user_agent text not null default '',
  app_version text not null default ''
);
create index client_errors_at_idx on public.client_errors (at desc);
alter table public.client_errors enable row level security;
create policy client_errors_insert on public.client_errors for insert to authenticated
  with check (user_id = auth.uid());
create policy client_errors_admin_read on public.client_errors for select to authenticated using (public.is_admin());
create policy client_errors_admin_delete on public.client_errors for delete to authenticated using (public.is_admin());
create policy active_users_only on public.client_errors as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

-- 3. clean-up by itself: the change log is kept 12 months, the error log 90 days, answered upload requests 12 months
create extension if not exists pg_cron;
select cron.schedule('purge-audit-log', '17 3 * * *', $$delete from public.audit_log where at < now() - interval '12 months'$$);
select cron.schedule('purge-client-errors', '23 3 * * *', $$delete from public.client_errors where at < now() - interval '90 days'$$);
select cron.schedule('purge-upload-requests', '29 3 * * *', $$delete from public.upload_requests where status in ('used', 'rejected') and created_at < now() - interval '12 months'$$);

-- 4. live updates: the screens of the other users refresh when one of these tables changes (the rules of access still apply)
alter publication supabase_realtime add table
  public.doctors, public.meetings, public.meeting_tasks, public.task_subtasks, public.patient_scans, public.hospitals,
  public.hospital_agents, public.planned_surgeries, public.competitor_intel, public.projects, public.project_updates,
  public.consumable_counts, public.upload_requests, public.doctor_stage_history;

-- 5. the health summary of the system (managers)
create or replace function public.system_health()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select jsonb_build_object(
    'db_bytes', pg_database_size(current_database()),
    'storage', coalesce((select jsonb_agg(jsonb_build_object('bucket', bucket_id, 'files', n, 'bytes', b)) from (
        select bucket_id, count(*) n, coalesce(sum((metadata ->> 'size')::bigint), 0) b from storage.objects group by bucket_id) s), '[]'::jsonb),
    'tables', coalesce((select jsonb_agg(jsonb_build_object('name', relname, 'rows', n_live_tup, 'bytes', pg_total_relation_size(relid))) from (
        select relname, n_live_tup, relid from pg_stat_user_tables where schemaname = 'public' order by pg_total_relation_size(relid) desc limit 12) t), '[]'::jsonb),
    'users', jsonb_build_object('total', (select count(*) from public.profiles), 'active', (select count(*) from public.profiles where active)),
    'audit', jsonb_build_object('rows', (select count(*) from public.audit_log), 'oldest', (select min(at) from public.audit_log)),
    'errors_24h', (select count(*) from public.client_errors where at > now() - interval '24 hours'),
    'errors_7d', (select count(*) from public.client_errors where at > now() - interval '7 days')
  ) into r;
  return r;
end;
$$;
revoke all on function public.system_health() from public, anon;
grant execute on function public.system_health() to authenticated;
