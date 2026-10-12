-- Public / private is a property of the hospital (editable in Settings), not of each doctor link.
-- Triggers keep doctor_hospitals.sector equal to the hospital's sector at all times.

update public.hospitals set sector = 'private' where name = 'אסותא אשדוד';

create or replace function public.doctor_hospital_sector_from_hospital()
returns trigger language plpgsql as $$
begin
  select sector into new.sector from public.hospitals where id = new.hospital_id;
  return new;
end
$$;

create trigger doctor_hospitals_sector_sync
  before insert or update of hospital_id, sector on public.doctor_hospitals
  for each row execute function public.doctor_hospital_sector_from_hospital();

create or replace function public.cascade_hospital_sector()
returns trigger language plpgsql as $$
begin
  update public.doctor_hospitals set sector = new.sector where hospital_id = new.id;
  return new;
end
$$;

create trigger hospitals_sector_cascade
  after update of sector on public.hospitals
  for each row when (old.sector is distinct from new.sector)
  execute function public.cascade_hospital_sector();

update public.doctor_hospitals dh
   set sector = h.sector
  from public.hospitals h
 where h.id = dh.hospital_id and dh.sector is distinct from h.sector;
