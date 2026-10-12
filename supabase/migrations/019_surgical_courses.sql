-- Surgical course ("מהלך ניתוחי") per doctor and procedure, built from editable stages.
--   procedure_template_stages : default stage titles for each procedure (edited in Settings)
--   doctor_surgical_courses   : one course per doctor + procedure (a copy of the template that can be edited)
--   doctor_course_stages / doctor_course_items : the doctor's own stages and their ordered lines

create table public.procedure_template_stages (
  id uuid primary key default gen_random_uuid(),
  procedure_id uuid not null references public.procedures(id) on delete cascade,
  title text not null,
  sort integer not null default 0
);
create index procedure_template_stages_idx on public.procedure_template_stages (procedure_id, sort);

create table public.doctor_surgical_courses (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  procedure_id uuid not null references public.procedures(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (doctor_id, procedure_id)
);
create trigger doctor_surgical_courses_updated_at before update on public.doctor_surgical_courses
  for each row execute function public.set_updated_at();

create table public.doctor_course_stages (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.doctor_surgical_courses(id) on delete cascade,
  title text not null,
  sort integer not null default 0
);
create index doctor_course_stages_idx on public.doctor_course_stages (course_id, sort);

create table public.doctor_course_items (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.doctor_course_stages(id) on delete cascade,
  text text not null default '',
  sort integer not null default 0
);
create index doctor_course_items_idx on public.doctor_course_items (stage_id, sort);

alter table public.procedure_template_stages enable row level security;
alter table public.doctor_surgical_courses   enable row level security;
alter table public.doctor_course_stages      enable row level security;
alter table public.doctor_course_items       enable row level security;

create policy "procedure_template_stages_all" on public.procedure_template_stages
  for all to authenticated using (true) with check (true);
create policy "doctor_surgical_courses_all" on public.doctor_surgical_courses
  for all to authenticated using (true) with check (true);
create policy "doctor_course_stages_all" on public.doctor_course_stages
  for all to authenticated using (true) with check (true);
create policy "doctor_course_items_all" on public.doctor_course_items
  for all to authenticated using (true) with check (true);

-- default stages for every existing procedure (editable per procedure in Settings)
insert into public.procedure_template_stages (procedure_id, title, sort)
select p.id, s.title, s.n
  from public.procedures p
 cross join (values
   ('הכנה לפני הניתוח', 1),
   ('השכבה', 2),
   ('לפני חיתוכים', 3),
   ('הכנת שתלים', 4),
   ('שתלים', 5),
   ('לשים לב', 6)
 ) as s(title, n);
