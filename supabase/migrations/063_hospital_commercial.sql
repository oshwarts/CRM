-- The commercial standing of a hospital and the next step with it. An empty status means "not set": the screens then
-- suggest one from the robots the hospital has.
alter table public.hospitals
  add column commercial_status text not null default '' check (commercial_status in ('', 'client', 'onboarding', 'potential', 'competitor', 'irrelevant')),
  add column next_step text not null default '',
  add column next_step_date date;
create index hospitals_commercial_status_idx on public.hospitals (commercial_status) where commercial_status <> '';
