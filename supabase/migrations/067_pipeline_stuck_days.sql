-- How long in one stage counts as "stuck": a default (app_settings key pipeline.stuck_days, 30 when not set) and an optional
-- value per stage (empty = the default).
alter table public.pipeline_stages add column stuck_days integer check (stuck_days is null or stuck_days between 1 and 365);
