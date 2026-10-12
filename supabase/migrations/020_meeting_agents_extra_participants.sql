-- Meeting participants beyond doctors and hospital contacts:
--   meeting_agents       : agents / managers (profiles) who take part, besides the responsible agent
--   extra_participants   : free text for anyone who is not in the system

alter table public.meetings
  add column extra_participants text not null default '';

create table public.meeting_agents (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  agent_id uuid not null references public.profiles(id) on delete cascade,
  primary key (meeting_id, agent_id)
);
alter table public.meeting_agents enable row level security;
create policy "meeting_agents_all" on public.meeting_agents
  for all to authenticated using (true) with check (true);
