-- a question can carry its own wrong answers (for the multiple-choice quiz) and an explanation shown after the answer
alter table public.learn_cards add column if not exists wrong_options text[] not null default '{}';
alter table public.learn_cards add column if not exists explanation text not null default '';
