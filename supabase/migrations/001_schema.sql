-- ===== profiles =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role text not null default 'agent' check (role in ('agent','admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  is_first boolean;
begin
  select count(*) = 0 into is_first from public.profiles;
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.email, ''),
    case when is_first then 'admin' else 'agent' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===== companies =====
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- ===== hospitals =====
create table public.hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null default '',
  sector text not null default 'public' check (sector in ('public','private')),
  lat double precision,
  lng double precision,
  address text not null default '',
  created_at timestamptz not null default now()
);

create table public.hospital_agents (
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  agent_id uuid not null references public.profiles(id) on delete cascade,
  primary key (hospital_id, agent_id)
);

-- ===== procedures =====
create table public.procedures (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null default 'other' check (category in ('knee','hip','shoulder','spine','other')),
  is_mako boolean not null default false,
  created_at timestamptz not null default now()
);

-- ===== doctors =====
create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text not null default 'דוקטור',
  position text not null default '',
  phone text not null default '',
  email text not null default '',
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger doctors_updated_at before update on public.doctors
  for each row execute function public.set_updated_at();

create table public.doctor_companies (
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  primary key (doctor_id, company_id)
);

create table public.doctor_hospitals (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  role_at_hospital text not null default '',
  sector text not null default 'public' check (sector in ('public','private')),
  unique (doctor_id, hospital_id)
);

create table public.doctor_procedures (
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  procedure_id uuid not null references public.procedures(id) on delete cascade,
  primary key (doctor_id, procedure_id)
);

create table public.doctor_preop_plans (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  procedure_id uuid references public.procedures(id) on delete set null,
  surgeon_preferences text not null default '',
  surgical_approach text not null default '',
  required_equipment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger preop_updated_at before update on public.doctor_preop_plans
  for each row execute function public.set_updated_at();

-- ===== favorites =====
create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, doctor_id)
);

-- ===== meetings =====
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  subject text not null default '',
  meeting_date date,
  meeting_time time,
  location text not null default '',
  responsible_agent_id uuid references public.profiles(id) on delete set null,
  summary text not null default '',
  decisions text not null default '',
  status text not null default 'scheduled' check (status in ('scheduled','done','cancelled','needs_followup')),
  next_followup_date date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger meetings_updated_at before update on public.meetings
  for each row execute function public.set_updated_at();

create table public.meeting_doctors (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  primary key (meeting_id, doctor_id)
);

create table public.meeting_tasks (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  description text not null default '',
  is_done boolean not null default false,
  due_date date,
  created_at timestamptz not null default now()
);

-- ===== indexes =====
create index doctor_hospitals_hospital_idx on public.doctor_hospitals (hospital_id);
create index doctor_hospitals_doctor_idx on public.doctor_hospitals (doctor_id);
create index doctor_procedures_doctor_idx on public.doctor_procedures (doctor_id);
create index doctor_companies_doctor_idx on public.doctor_companies (doctor_id);
create index meeting_doctors_doctor_idx on public.meeting_doctors (doctor_id);
create index meetings_followup_idx on public.meetings (next_followup_date);
create index meetings_agent_idx on public.meetings (responsible_agent_id);
create index preop_doctor_idx on public.doctor_preop_plans (doctor_id);
create index meeting_tasks_meeting_idx on public.meeting_tasks (meeting_id);
create index hospital_agents_agent_idx on public.hospital_agents (agent_id);
