-- The competitor activity written in a meeting is also a competitor_intel record tied to the meeting (kept in line by the app
-- every time the meeting is saved). Meetings written before that get their record now; the competitor stays empty until somebody
-- picks it on the record, so nothing is guessed from the text.
insert into public.competitor_intel (competitor, notes, intel_date, doctor_id, hospital_id, meeting_id, created_by)
select '',
       btrim(m.competitor_notes),
       coalesce(m.meeting_date, m.created_at::date),
       (select d.doctor_id from public.meeting_doctors d where d.meeting_id = m.id order by d.doctor_id limit 1),
       m.hospital_id,
       m.id,
       m.created_by
from public.meetings m
where btrim(m.competitor_notes) <> ''
  and not exists (select 1 from public.competitor_intel i where i.meeting_id = m.id);
