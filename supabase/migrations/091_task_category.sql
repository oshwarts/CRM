-- personal task organization: every task (own CRM work included) can be tagged personal/work/study, for the
-- agent's own filtering — existing rows default to 'work' since the CRM's tasks were effectively all work until now.
alter table public.meeting_tasks
  add column category text not null default 'work' check (category in ('personal', 'work', 'study'));
