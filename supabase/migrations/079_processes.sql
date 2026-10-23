-- Processes ("תהליכים"): editable templates (onboarding of an agent, a new hospital, an agent leaving, MAKO training...) and the
-- processes started from them. The steps of a started process are real tasks (meeting_tasks.process_id): they show on the tasks
-- screen, with an owner and a due date. Managers write templates and start / edit processes; an agent sees what is assigned to him.

create table public.process_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  -- what the template is for: the app suggests agent_in when an agent joins and agent_out when one leaves
  kind text not null default 'other' check (kind in ('agent_in', 'agent_out', 'hospital_in', 'training', 'other')),
  -- who or what a process of this template is about
  subject text not null default 'none' check (subject in ('agent', 'hospital', 'none')),
  sort int not null default 0,
  created_by uuid references public.profiles(id) on delete set null default public.effective_uid(),
  created_at timestamptz not null default now()
);

create table public.process_template_steps (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.process_templates(id) on delete cascade,
  sort int not null default 0,
  title text not null,
  notes text not null default '',
  -- days from the start of the process (a negative number = before it)
  day_offset int not null default 0,
  -- 'subject' = the agent the process is about (else the manager who starts it); 'starter' = the manager who starts it
  owner text not null default 'starter' check (owner in ('subject', 'starter'))
);
create index process_template_steps_idx on public.process_template_steps (template_id, sort);

create table public.processes (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.process_templates(id) on delete set null,
  name text not null,
  kind text not null default 'other',
  subject_agent_id uuid references public.profiles(id) on delete set null,
  subject_hospital_id uuid references public.hospitals(id) on delete set null,
  start_date date not null default current_date,
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_on date,
  closed_by uuid references public.profiles(id) on delete set null,
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null default public.effective_uid(),
  created_at timestamptz not null default now()
);
create index processes_status_idx on public.processes (status, start_date);
create index processes_agent_idx on public.processes (subject_agent_id);

alter table public.meeting_tasks add column process_id uuid references public.processes(id) on delete cascade;
create index meeting_tasks_process_idx on public.meeting_tasks (process_id) where process_id is not null;

-- who may open a process: a manager, the agent it is about, and whoever has a step assigned
create or replace function public.can_see_process(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select pid is not null and (
    public.is_admin()
    or exists (select 1 from public.processes p where p.id = pid and p.subject_agent_id = public.effective_uid())
    or exists (select 1 from public.meeting_tasks t where t.process_id = pid and t.assignee_id = public.effective_uid())
  )
$$;
revoke execute on function public.can_see_process(uuid) from public, anon;
grant execute on function public.can_see_process(uuid) to authenticated;

alter table public.process_templates enable row level security;
alter table public.process_template_steps enable row level security;
alter table public.processes enable row level security;

create policy process_templates_read on public.process_templates for select to authenticated using (public.is_admin());
create policy process_templates_write on public.process_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy process_template_steps_read on public.process_template_steps for select to authenticated using (public.is_admin());
create policy process_template_steps_write on public.process_template_steps for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy processes_read on public.processes for select to authenticated using (public.can_see_process(id));
create policy processes_write on public.processes for all to authenticated using (public.is_admin()) with check (public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['process_templates', 'process_template_steps', 'processes'] loop
    execute format('create policy active_users_only on public.%I as restrictive for all to authenticated using ((select public.is_active())) with check ((select public.is_active()))', t);
  end loop;
end $$;

create trigger audit_process_templates after insert or update or delete on public.process_templates for each row execute function public.audit_row();
create trigger audit_processes after insert or update or delete on public.processes for each row execute function public.audit_row();

-- the starting templates (all of it can be edited in the app)
do $$
declare tid uuid;
begin
  insert into public.process_templates (name, description, kind, subject, sort) values ('קליטת סוכן חדש', 'מהיום הראשון ועד סיכום החודש הראשון', 'agent_in', 'agent', 0) returning id into tid;
  insert into public.process_template_steps (template_id, sort, title, notes, day_offset, owner) values
    (tid, 0, 'פתיחת משתמש והרשאות במערכת', '', 0, 'starter'),
    (tid, 1, 'הכנת ציוד אישי (מחשב, טלפון)', '', 0, 'starter'),
    (tid, 2, 'סיור ראשון במערכת ה-CRM', '', 1, 'subject'),
    (tid, 3, 'היכרות עם החברה והמוצרים', '', 2, 'subject'),
    (tid, 4, 'פגישה עם המנהל והצגת יעדים', '', 3, 'starter'),
    (tid, 5, 'התחלת מסלול ההכשרה בלומדה', '', 5, 'subject'),
    (tid, 6, 'היכרות עם הרופאים ובתי החולים באחריותו', '', 7, 'starter'),
    (tid, 7, 'ליווי בפגישה ראשונה בשטח', '', 14, 'starter'),
    (tid, 8, 'שיחת סיכום חודש ראשון', '', 30, 'starter');

  insert into public.process_templates (name, description, kind, subject, sort) values ('הכשרת סוכן לרובוט MAKO', 'מההכשרה התיאורטית ועד ניתוחי סולו', 'training', 'agent', 1) returning id into tid;
  insert into public.process_template_steps (template_id, sort, title, notes, day_offset, owner) values
    (tid, 0, 'השלמת הלומדה והמבחן', '', 14, 'subject'),
    (tid, 1, 'צפייה בניתוחים עם מאקו', '', 21, 'subject'),
    (tid, 2, 'ליווי צמוד בניתוח ראשון', '', 30, 'starter'),
    (tid, 3, 'ניתוחי סולו', 'לפי מספר הניתוחים שנקבע בשלבי ההכשרה', 60, 'subject'),
    (tid, 4, 'בחינת סיום ואישור המנהל', '', 75, 'starter');

  insert into public.process_templates (name, description, kind, subject, sort) values ('קבלת בית חולים חדש', 'מההיכרות ועד שהבית החולים מנוהל במערכת', 'hospital_in', 'hospital', 2) returning id into tid;
  insert into public.process_template_steps (template_id, sort, title, notes, day_offset, owner) values
    (tid, 0, 'הכרת אנשי הקשר בבית החולים', 'רכש, מכון דימות, אחות אחראית ואנשי הקשר של המנתחים', 0, 'starter'),
    (tid, 1, 'הסדרת אספקה סטרילית', '', 3, 'starter'),
    (tid, 2, 'הגדרת מתכלים ומינימום מלאי', 'אם יש רובוט MAKO בבית החולים', 5, 'starter'),
    (tid, 3, 'תחום אחריות: ניהול מטופלים', '', 7, 'starter'),
    (tid, 4, 'תחום אחריות: ניהול רופאים', '', 7, 'starter'),
    (tid, 5, 'תחום אחריות: הזנת ניתוחים', '', 7, 'starter'),
    (tid, 6, 'תחום אחריות: וידוא סריקות', '', 7, 'starter'),
    (tid, 7, 'בדיקת פגי תוקף', '', 10, 'starter');

  insert into public.process_templates (name, description, kind, subject, sort) values ('עזיבת סוכן', 'העברת האחריות, החזרת ציוד וסגירת הרשאות', 'agent_out', 'agent', 3) returning id into tid;
  insert into public.process_template_steps (template_id, sort, title, notes, day_offset, owner) values
    (tid, 0, 'הודעה לצוות ולרופאים ולבתי החולים', '', 0, 'starter'),
    (tid, 1, 'העברת רופאים ובתי חולים לסוכן אחר', '', 0, 'starter'),
    (tid, 2, 'העברת משימות פתוחות וניתוחים מתוכננים', '', 1, 'starter'),
    (tid, 3, 'החזרת ציוד (מחשב, טלפון, מכשור)', '', 2, 'subject'),
    (tid, 4, 'ראיון יציאה', '', 3, 'starter'),
    (tid, 5, 'ביטול הרשאות והשבתת המשתמש', '', 4, 'starter'),
    (tid, 6, 'העברת קבצים ומסמכים', '', 4, 'starter');
end $$;
