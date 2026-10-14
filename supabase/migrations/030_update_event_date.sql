-- Project updates get the date the event happened (can be back-dated), for calendar-style follow-up.
alter table public.project_updates add column event_date date not null default current_date;
update public.project_updates set event_date = (created_at at time zone 'Asia/Jerusalem')::date;
create index project_updates_event_idx on public.project_updates (project_id, event_date desc);
