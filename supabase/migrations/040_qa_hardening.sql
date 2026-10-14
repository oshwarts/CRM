-- QA hardening: the developer-field guard gets a fixed search_path (security advisor warning), and the foreign keys of the
-- tables that grow with use get covering indexes (joins / cascades / "my records" lookups stay fast as data accumulates).
alter function public.protect_developer_fields() set search_path = public;

create index if not exists meeting_tasks_doctor_idx on public.meeting_tasks (doctor_id);
create index if not exists meeting_tasks_hospital_idx on public.meeting_tasks (hospital_id);
create index if not exists meeting_tasks_created_by_idx on public.meeting_tasks (created_by);
create index if not exists meeting_tasks_contact_idx on public.meeting_tasks (contact_id);
create index if not exists meeting_agents_agent_idx on public.meeting_agents (agent_id);
create index if not exists meeting_contacts_contact_idx on public.meeting_contacts (contact_id);
create index if not exists meetings_created_by_idx on public.meetings (created_by);
create index if not exists doctors_created_by_idx on public.doctors (created_by);
create index if not exists patient_scans_created_by_idx on public.patient_scans (created_by);
create index if not exists projects_owner_idx on public.projects (owner_id);
create index if not exists projects_hospital_idx on public.projects (hospital_id);
create index if not exists project_updates_author_idx on public.project_updates (author_id);
create index if not exists competitor_intel_meeting_idx on public.competitor_intel (meeting_id);
create index if not exists doctor_companies_company_idx on public.doctor_companies (company_id);
create index if not exists doctor_procedures_procedure_idx on public.doctor_procedures (procedure_id);
