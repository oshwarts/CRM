-- Investigations ("תחקירים") on a doctor: what the problem was, its root cause, the solution, and the investigation file.
-- Everybody who works with the doctors can read and add; a manager or whoever created an investigation can delete it.
-- The file itself is stored in the info-docs bucket under investigations/<doctor>/ (storage rules of that bucket apply).

create table public.doctor_investigations (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  event_date date not null default current_date,
  title text not null,
  problem text not null default '',
  root_cause text not null default '',
  solution text not null default '',
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_on date,
  file_path text,
  file_name text not null default '',
  file_size bigint not null default 0,
  mime text not null default '',
  created_by uuid references public.profiles(id) on delete set null default public.effective_uid(),
  created_at timestamptz not null default now()
);
create index doctor_investigations_doctor_idx on public.doctor_investigations (doctor_id, event_date desc);

alter table public.doctor_investigations enable row level security;
create policy doctor_investigations_read on public.doctor_investigations for select to authenticated using (true);
create policy doctor_investigations_insert on public.doctor_investigations for insert to authenticated with check (true);
create policy doctor_investigations_update on public.doctor_investigations for update to authenticated using (true) with check (true);
create policy doctor_investigations_delete on public.doctor_investigations for delete to authenticated
  using (public.is_admin() or created_by = public.effective_uid());
create policy active_users_only on public.doctor_investigations as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create trigger audit_doctor_investigations after insert or update or delete on public.doctor_investigations
  for each row execute function public.audit_row();
