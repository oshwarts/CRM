-- how many surgeries of this kind the entry stands for (for example 5 manual knee replacements on one day)
alter table public.planned_surgeries add column cases integer not null default 1 check (cases between 1 and 99);
