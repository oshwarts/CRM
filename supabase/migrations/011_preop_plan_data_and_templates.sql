-- Structured MAKO-style pre-op planning data (stored as JSON per plan) and a
-- planning template selector on procedures.

alter table public.doctor_preop_plans
  add column plan_data jsonb not null default '{}'::jsonb;

alter table public.procedures
  add column planning_template text not null default 'generic';

update public.procedures set planning_template = 'mako_tka'
  where name = 'החלפת ברך – MAKO';
update public.procedures set planning_template = 'mako_pka'
  where name = 'החלפת ברך חלקית (יוני) – MAKO';
update public.procedures set planning_template = 'mako_tha'
  where name = 'החלפת ירך – MAKO';
