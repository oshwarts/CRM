-- A due date for each step (sub-task) of a task
alter table public.task_subtasks add column if not exists due_date date;
