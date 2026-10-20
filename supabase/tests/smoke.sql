-- Smoke tests of the database, run after a migration (SQL Editor, or the Supabase MCP `execute_sql`).
-- Each block acts as a real user (an agent, then a manager), tries what the app does, and ends with an exception that
-- carries the results — so that nothing is left changed. Read the line "RESULT …" in the error message.
-- Expected values are written above every block.

-- 1. Write paths of the app. Expected:
--    lost:1 back:1 stage:1 hospital:1 bogus:rejected surgery:ok err:ok agent_stage:blocked agent_setting:blocked
--    admin_setting:ok admin_stage:ok rename:ok robot_link:ok
do $$
declare a uuid; g uuid; d uuid; h uuid; res text := ''; n int;
begin
  select id into a from public.profiles where role = 'admin' and active limit 1;
  select id into g from public.profiles where role = 'agent' and active limit 1;
  select id into d from public.doctors where status = 'potential' limit 1;
  select id into h from public.hospitals limit 1;
  if h is null then insert into public.hospitals (name) values ('בדיקה') returning id into h; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin update public.doctors set status = 'lost', lost_reason = 'בחר מתחרה', lost_at = current_date where id = d; get diagnostics n = row_count; res := res || 'lost:' || n || ' '; exception when others then res := res || 'lost:ERR ' || sqlerrm || ' '; end;
  begin update public.doctors set status = 'potential', lost_reason = '', lost_at = null where id = d; get diagnostics n = row_count; res := res || 'back:' || n || ' '; exception when others then res := res || 'back:ERR ' || sqlerrm || ' '; end;
  begin update public.doctors set pipeline_stage = 'יצירת קשר', next_step = 'לקבוע', next_step_date = current_date + 3, contact_cadence_days = 30 where id = d; get diagnostics n = row_count; res := res || 'stage:' || n || ' '; exception when others then res := res || 'stage:ERR ' || sqlerrm || ' '; end;
  begin update public.hospitals set commercial_status = 'client', next_step = 'הצגה', next_step_date = current_date + 5 where id = h; get diagnostics n = row_count; res := res || 'hospital:' || n || ' '; exception when others then res := res || 'hospital:ERR ' || sqlerrm || ' '; end;
  begin update public.hospitals set commercial_status = 'bogus' where id = h; res := res || 'bogus:ALLOWED '; exception when others then res := res || 'bogus:rejected '; end;
  begin insert into public.planned_surgeries (surgery_date, procedure, cases, doctor_id, hospital_id) values (current_date, 'ברך ידנית', 5, d, h); res := res || 'surgery:ok '; exception when others then res := res || 'surgery:ERR ' || sqlerrm || ' '; end;
  begin insert into public.client_errors (message) values ('x'); res := res || 'err:ok '; exception when others then res := res || 'err:ERR ' || sqlerrm || ' '; end;
  begin insert into public.pipeline_stages (name) values ('x'); res := res || 'agent_stage:ALLOWED '; exception when others then res := res || 'agent_stage:blocked '; end;
  begin insert into public.app_settings (key, value) values ('ai.enabled', '1'); res := res || 'agent_setting:ALLOWED '; exception when others then res := res || 'agent_setting:blocked '; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin insert into public.app_settings (key, value) values ('zz.test', '1') on conflict (key) do update set value = '2'; res := res || 'admin_setting:ok '; exception when others then res := res || 'admin_setting:ERR ' || sqlerrm || ' '; end;
  begin update public.pipeline_stages set suggested_step = 'x', stuck_days = 14 where name = 'יצירת קשר'; res := res || 'admin_stage:ok '; exception when others then res := res || 'admin_stage:ERR ' || sqlerrm || ' '; end;
  begin perform public.rename_pipeline_stage((select id from public.pipeline_stages where name = 'יצירת קשר'), 'יצירת קשר 2'); res := res || 'rename:ok '; exception when others then res := res || 'rename:ERR ' || sqlerrm || ' '; end;
  begin insert into public.company_robotic_systems select c.id, r.id from public.companies c, public.robotic_systems r limit 1 on conflict do nothing; res := res || 'robot_link:ok '; exception when others then res := res || 'robot_link:ERR ' || sqlerrm || ' '; end;
  raise exception 'RESULT %', res;
end $$;

-- 2. Large-file approval. Expected:
--    first=created second=pending agent_self_approve_rows=0 admin_approve_rows=1 after_approve=approved status_after_finish=used
--    storage: agent_no_ticket=blocked, with a pending request blocked, with an approved request allowed, admin allowed, normal bucket ok
do $$
declare a uuid; g uuid; r1 jsonb; r2 jsonb; r3 jsonb; agent_decide int; admin_decide int; st text; s1 text; s2 text; s3 text; s4 text;
begin
  select id into a from public.profiles where role = 'admin' and active limit 1;
  select id into g from public.profiles where role = 'agent' and active limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin insert into storage.objects (bucket_id, name, owner) values ('info-docs-large', 't/x.pdf', g); s1 := 'ALLOWED'; exception when others then s1 := 'blocked'; end;
  r1 := public.request_large_upload('big.pdf', 30000000, 'מידע קליני');
  r2 := public.request_large_upload('big.pdf', 30000000, 'מידע קליני');
  begin insert into storage.objects (bucket_id, name, owner) values ('info-docs-large', 't/x.pdf', g); s2 := 'ALLOWED'; exception when others then s2 := 'blocked'; end;
  update public.upload_requests set status = 'approved' where id = (r1 ->> 'id')::uuid; get diagnostics agent_decide = row_count;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.upload_requests set status = 'approved', decided_by = a, decided_at = now() where id = (r1 ->> 'id')::uuid; get diagnostics admin_decide = row_count;
  begin insert into storage.objects (bucket_id, name, owner) values ('info-docs-large', 't/z.pdf', a); s4 := 'ALLOWED'; exception when others then s4 := 'blocked'; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r3 := public.request_large_upload('big.pdf', 30000000, 'x');
  begin insert into storage.objects (bucket_id, name, owner) values ('info-docs-large', 't/y.pdf', g); s3 := 'ALLOWED'; exception when others then s3 := 'blocked'; end;
  perform public.finish_large_upload((r1 ->> 'id')::uuid);
  select status into st from public.upload_requests where id = (r1 ->> 'id')::uuid;
  raise exception 'RESULT first=% second=% agent_self_approve_rows=% admin_approve_rows=% after_approve=% status_after_finish=% storage: no_ticket=% pending=% approved=% admin=%',
    r1 ->> 'state', r2 ->> 'state', agent_decide, admin_decide, r3 ->> 'state', st, s1, s2, s3, s4;
end $$;

-- 3. Funnel history and rename. Expected: hist_after_move=1 doctor_follows_rename=<new name> hist_after_rename=1 hist_after_clear=2
do $$
declare a uuid; d uuid; sid uuid; h1 int; h2 int; h3 int; nm text;
begin
  select id into a from public.profiles where role = 'admin' and active limit 1;
  select id into d from public.doctors where status = 'potential' limit 1;
  select id into sid from public.pipeline_stages order by sort limit 1 offset 5;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.doctors set pipeline_stage = (select name from public.pipeline_stages where id = sid) where id = d;
  select count(*) into h1 from public.doctor_stage_history where doctor_id = d;
  perform public.rename_pipeline_stage(sid, 'שם חדש לבדיקה');
  select pipeline_stage into nm from public.doctors where id = d;
  select count(*) into h2 from public.doctor_stage_history where doctor_id = d;
  update public.doctors set pipeline_stage = '' where id = d;
  select count(*) into h3 from public.doctor_stage_history where doctor_id = d;
  raise exception 'RESULT hist_after_move=% doctor_follows_rename=% hist_after_rename=% hist_after_clear=%', h1, nm, h2, h3;
end $$;

-- 4. Procedure tree, requests, clinics and suggestions (migrations 072-074). Run as an agent, then a manager, then the developer. Expected:
--    agent_add_proc:blocked agent_request:ok agent_decide:blocked agent_suggest:ok clinic:ok clinic_bad_day:rejected
--    admin_sees_suggestions:0 admin_sees_request:1 admin_decide:ok linked_to_doctor:1 two_levels:rejected dev_sees_suggestion:1 dev_answer_rows:1
-- (the block that produced this is in the commit message of migration 072; the checks: procedures are written by managers only,
--  a request is decided by a manager only and adds the procedure to the doctor, one level of sub-procedures, a suggestion is read only
--  by its writer and by the developer, clinic days are 0-6)
