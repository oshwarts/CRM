-- deleting a doctor, hospital or meeting: managers, or the user who created the doctor / meeting. Hospitals: managers only.
-- (everyone keeps reading, adding and editing; deleting also cascades to volumes, plans, tasks …)
drop policy doctors_all on public.doctors;
create policy doctors_select on public.doctors for select to authenticated using (true);
create policy doctors_insert on public.doctors for insert to authenticated with check (true);
create policy doctors_update on public.doctors for update to authenticated using (true) with check (true);
create policy doctors_delete on public.doctors for delete to authenticated using (public.is_admin() or created_by = public.effective_uid());

drop policy hospitals_all on public.hospitals;
create policy hospitals_select on public.hospitals for select to authenticated using (true);
create policy hospitals_insert on public.hospitals for insert to authenticated with check (true);
create policy hospitals_update on public.hospitals for update to authenticated using (true) with check (true);
create policy hospitals_delete on public.hospitals for delete to authenticated using (public.is_admin());

drop policy meetings_all on public.meetings;
create policy meetings_select on public.meetings for select to authenticated using (true);
create policy meetings_insert on public.meetings for insert to authenticated with check (true);
create policy meetings_update on public.meetings for update to authenticated using (true) with check (true);
create policy meetings_delete on public.meetings for delete to authenticated using (public.is_admin() or created_by = public.effective_uid());
