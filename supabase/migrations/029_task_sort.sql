-- Order of tasks inside a project area (moved up / down or dragged by the user).
alter table public.meeting_tasks add column sort int not null default (extract(epoch from now())::int);

-- existing project tasks keep their current order (by creation time), numbered from 0 inside each area
update public.meeting_tasks t set sort = r.n
from (
  select id, (row_number() over (partition by project_id, area_id order by created_at, id) - 1)::int as n
  from public.meeting_tasks where project_id is not null
) r
where t.id = r.id;
