-- An additional office phone for contacts.
alter table public.contacts add column office_phone text not null default '';
