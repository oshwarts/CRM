-- a lesson can point at documents of the clinical-information library (no second upload of the same file)
alter table public.learn_lessons add column if not exists doc_ids uuid[] not null default '{}';
