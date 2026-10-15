-- a question can belong to a lesson (asked about that lesson); deleting the lesson keeps the question in the topic
alter table public.learn_cards add column if not exists lesson_id uuid references public.learn_lessons(id) on delete set null;
create index if not exists learn_cards_lesson_idx on public.learn_cards (lesson_id) where lesson_id is not null;
