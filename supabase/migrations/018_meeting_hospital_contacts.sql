-- A meeting belongs to one hospital, and its participants can be hospital contacts
-- (procurement, imaging institute…) in addition to doctors.

alter table public.meetings
  add column hospital_id uuid references public.hospitals(id) on delete set null;
create index meetings_hospital_idx on public.meetings (hospital_id, meeting_date desc);

create table public.meeting_contacts (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  primary key (meeting_id, contact_id)
);
alter table public.meeting_contacts enable row level security;
create policy "meeting_contacts_all" on public.meeting_contacts
  for all to authenticated using (true) with check (true);

-- backfill: hospital named in the location / subject
update public.meetings m set hospital_id = h.id
  from public.hospitals h
 where m.hospital_id is null
   and h.name in ('ברזילי', 'בני ציון', 'העמק')
   and (m.location like '%' || h.name || '%' or m.subject like '%' || h.name || '%');

update public.meetings m set hospital_id = h.id
  from public.hospitals h
 where m.hospital_id is null
   and h.name = 'שמיר – אסף הרופא'
   and (m.location like '%אסף הרופא%' or m.subject like '%אסף הרופא%');

-- backfill: all participating doctors share exactly one hospital
update public.meetings m set hospital_id = x.hospital_id
  from (
    select md.meeting_id, min(dh.hospital_id::text)::uuid as hospital_id
      from public.meeting_doctors md
      join public.doctor_hospitals dh on dh.doctor_id = md.doctor_id
     group by md.meeting_id
    having count(distinct dh.hospital_id) = 1
  ) x
 where m.id = x.meeting_id and m.hospital_id is null;
