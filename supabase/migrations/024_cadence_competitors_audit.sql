-- 1. contact cadence per doctor, 2. competitor intelligence, 3. audit log (admin-only view)

-- ===== contact cadence =====
alter table public.doctors
  add column contact_cadence_days int check (contact_cadence_days is null or contact_cadence_days > 0);

-- ===== competitor activity =====
alter table public.meetings add column competitor_notes text not null default '';

create table public.competitor_intel (
  id uuid primary key default gen_random_uuid(),
  competitor text not null default '',
  product text not null default '',
  offer text not null default '',
  notes text not null default '',
  intel_date date not null default current_date,
  doctor_id uuid references public.doctors(id) on delete set null,
  hospital_id uuid references public.hospitals(id) on delete set null,
  meeting_id uuid references public.meetings(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index competitor_intel_doctor_idx on public.competitor_intel (doctor_id);
create index competitor_intel_hospital_idx on public.competitor_intel (hospital_id);
create trigger competitor_intel_updated_at before update on public.competitor_intel
  for each row execute function public.set_updated_at();
alter table public.competitor_intel enable row level security;
create policy competitor_intel_all on public.competitor_intel for all to authenticated using (true) with check (true);
create policy active_users_only on public.competitor_intel as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

-- ===== audit log =====
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid,
  user_name text not null default '',
  table_name text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  record_id text not null default '',
  label text not null default '',
  changed_fields text[] not null default '{}',
  detail jsonb
);
create index audit_log_at_idx on public.audit_log (at desc);
create index audit_log_user_idx on public.audit_log (user_id, at desc);
alter table public.audit_log enable row level security;
-- only admins can read; nobody can write from the client (rows are written by the trigger below)
create policy audit_log_admin_read on public.audit_log for select to authenticated using (public.is_admin());
create policy active_users_only on public.audit_log as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  j jsonb;
  o jsonb;
  changed text[];
  lbl text := '';
  uname text;
  det jsonb;
begin
  begin
    if tg_op = 'DELETE' then j := to_jsonb(old); else j := to_jsonb(new); end if;
    if tg_op = 'UPDATE' then
      o := to_jsonb(old);
      select coalesce(array_agg(k order by k), '{}') into changed
        from jsonb_object_keys(j) k
        where k <> 'updated_at' and (j -> k) is distinct from (o -> k);
      if coalesce(array_length(changed, 1), 0) = 0 then return new; end if;
    end if;
    -- patient records are logged without the patient's name
    if tg_table_name <> 'patient_scans' then
      lbl := coalesce(nullif(j ->> 'name', ''), nullif(j ->> 'subject', ''), nullif(j ->> 'description', ''),
                      nullif(j ->> 'title', ''), nullif(j ->> 'email', ''), nullif(j ->> 'competitor', ''), '');
    end if;
    if tg_table_name = 'profiles' and tg_op = 'UPDATE' then
      det := jsonb_build_object('role', j ->> 'role', 'active', j ->> 'active');
    end if;
    select full_name into uname from public.profiles where id = auth.uid();
    insert into public.audit_log (user_id, user_name, table_name, action, record_id, label, changed_fields, detail)
    values (auth.uid(), coalesce(uname, ''), tg_table_name, lower(tg_op), coalesce(j ->> 'id', ''), left(lbl, 120),
            coalesce(changed, '{}'), det);
  exception when others then
    null; -- the log must never block real work
  end;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke execute on function public.audit_row() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['doctors', 'hospitals', 'contacts', 'meetings', 'meeting_tasks', 'patient_scans',
                           'info_documents', 'profiles', 'competitor_intel', 'consumable_counts', 'doctor_surgical_courses']
  loop
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$I for each row execute function public.audit_row()', t);
  end loop;
end $$;
