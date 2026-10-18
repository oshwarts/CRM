-- "Closed as not relevant" (status 'lost', migration 065) was refused by the old check that only allowed client / potential.
alter table public.doctors drop constraint doctors_status_check;
alter table public.doctors add constraint doctors_status_check check (status in ('client', 'potential', 'lost'));
