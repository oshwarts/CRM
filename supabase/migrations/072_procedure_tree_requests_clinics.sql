-- 1. Procedures inside procedures (one level: a parent with sub-procedures, e.g. GMRS with its options)
alter table public.procedures add column parent_id uuid references public.procedures(id) on delete restrict;
create index procedures_parent_idx on public.procedures (parent_id);

create or replace function public.procedures_one_level() returns trigger language plpgsql as $$
begin
  if new.parent_id is not null then
    if new.parent_id = new.id then raise exception 'a procedure cannot be its own parent'; end if;
    if exists (select 1 from public.procedures p where p.id = new.parent_id and p.parent_id is not null) then
      raise exception 'only one level of sub-procedures is allowed';
    end if;
    if exists (select 1 from public.procedures c where c.parent_id = new.id) then
      raise exception 'this procedure has sub-procedures, it cannot be a sub-procedure itself';
    end if;
  end if;
  return new;
end $$;
create trigger procedures_one_level before insert or update of parent_id on public.procedures
  for each row execute function public.procedures_one_level();

-- the list of procedures is changed by managers only (agents ask for a new one: procedure_requests)
drop policy procedures_all on public.procedures;
create policy procedures_read on public.procedures for select to authenticated using (true);
create policy procedures_admin_write on public.procedures for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 2. Requests for a new procedure
create table public.procedure_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null default public.effective_uid() references public.profiles(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  parent_id uuid references public.procedures(id) on delete set null,
  doctor_id uuid references public.doctors(id) on delete set null,
  note text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  decision_note text not null default '',
  procedure_id uuid references public.procedures(id) on delete set null,
  created_at timestamptz not null default now()
);
create index procedure_requests_user_idx on public.procedure_requests (requested_by, created_at desc);
create index procedure_requests_status_idx on public.procedure_requests (status) where status = 'pending';
create index procedure_requests_parent_idx on public.procedure_requests (parent_id);
create index procedure_requests_doctor_idx on public.procedure_requests (doctor_id);
create index procedure_requests_decided_by_idx on public.procedure_requests (decided_by);
create index procedure_requests_procedure_idx on public.procedure_requests (procedure_id);

alter table public.procedure_requests enable row level security;
create policy procedure_requests_read on public.procedure_requests for select to authenticated
  using (requested_by = public.effective_uid() or public.is_admin());
create policy procedure_requests_insert on public.procedure_requests for insert to authenticated
  with check (requested_by = public.effective_uid() and status = 'pending');
create policy procedure_requests_admin_update on public.procedure_requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy active_users_only on public.procedure_requests as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));
create trigger audit_procedure_requests after insert or update or delete on public.procedure_requests
  for each row execute function public.audit_row();

-- a manager approves (the procedure is created, and added to the doctor it was asked for) or rejects
create or replace function public.decide_procedure_request(p_id uuid, p_approve boolean, p_name text default null, p_parent uuid default null, p_note text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.procedure_requests;
  new_id uuid;
begin
  if not public.is_admin() then raise exception 'only admins'; end if;
  select * into r from public.procedure_requests where id = p_id and status = 'pending' for update;
  if not found then raise exception 'request not found or already decided'; end if;
  if p_approve then
    insert into public.procedures (name, parent_id) values (btrim(coalesce(nullif(btrim(p_name), ''), r.name)), p_parent) returning id into new_id;
    if r.doctor_id is not null then
      insert into public.doctor_procedures (doctor_id, procedure_id) values (r.doctor_id, new_id) on conflict do nothing;
    end if;
    update public.procedure_requests set status = 'approved', procedure_id = new_id, decided_by = public.effective_uid(), decided_at = now(), decision_note = left(coalesce(p_note, ''), 300) where id = p_id;
    return new_id;
  end if;
  update public.procedure_requests set status = 'rejected', decided_by = public.effective_uid(), decided_at = now(), decision_note = left(coalesce(p_note, ''), 300) where id = p_id;
  return null;
end $$;
revoke all on function public.decide_procedure_request(uuid, boolean, text, uuid, text) from public, anon;
grant execute on function public.decide_procedure_request(uuid, boolean, text, uuid, text) to authenticated;

-- 3. Clinic days: public (a doctor's days at a hospital) and private (a doctor's own clinics, with an address)
alter table public.doctor_hospitals
  add column clinic_days smallint[] not null default '{}',
  add column clinic_hours text not null default '',
  add column clinic_note text not null default '',
  add constraint doctor_hospitals_clinic_days_check check (clinic_days <@ array[0,1,2,3,4,5,6]::smallint[]);

create table public.doctor_private_clinics (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  address text not null default '',
  clinic_days smallint[] not null default '{}' check (clinic_days <@ array[0,1,2,3,4,5,6]::smallint[]),
  created_at timestamptz not null default now()
);
create index doctor_private_clinics_doctor_idx on public.doctor_private_clinics (doctor_id);
alter table public.doctor_private_clinics enable row level security;
create policy doctor_private_clinics_all on public.doctor_private_clinics for all to authenticated using (true) with check (true);
create policy active_users_only on public.doctor_private_clinics as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));
create trigger audit_doctor_private_clinics after insert or update or delete on public.doctor_private_clinics
  for each row execute function public.audit_row();

-- the trigger function runs with a fixed search path
alter function public.procedures_one_level() set search_path = public;
