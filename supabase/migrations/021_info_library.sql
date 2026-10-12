-- "מידע": a library of clinical / equipment documents per procedure.
--   info_categories           : editable categories (Surgical Protocol, Surgical Technique, studies…)
--   info_documents            : a file (stored in the info-docs bucket) or an external link
--   info_document_procedures  : a document can belong to several procedures; none = general
-- Everyone signed in can read and upload; only admins delete.

create table public.info_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort integer not null default 0
);

create table public.info_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  category_id uuid references public.info_categories(id) on delete set null,
  kind text not null default 'file' check (kind in ('file', 'link')),
  url text not null default '',
  storage_path text not null default '',
  file_name text not null default '',
  file_size bigint not null default 0,
  mime text not null default '',
  tags text[] not null default '{}',
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger info_documents_updated_at before update on public.info_documents
  for each row execute function public.set_updated_at();
create index info_documents_category_idx on public.info_documents (category_id);

create table public.info_document_procedures (
  document_id uuid not null references public.info_documents(id) on delete cascade,
  procedure_id uuid not null references public.procedures(id) on delete cascade,
  primary key (document_id, procedure_id)
);

alter table public.info_categories          enable row level security;
alter table public.info_documents           enable row level security;
alter table public.info_document_procedures enable row level security;

create policy "info_categories_all" on public.info_categories
  for all to authenticated using (true) with check (true);
create policy "info_documents_read" on public.info_documents
  for select to authenticated using (true);
create policy "info_documents_insert" on public.info_documents
  for insert to authenticated with check (true);
create policy "info_documents_update" on public.info_documents
  for update to authenticated using (true) with check (true);
create policy "info_documents_delete_admin" on public.info_documents
  for delete to authenticated using (public.is_admin());
create policy "info_document_procedures_all" on public.info_document_procedures
  for all to authenticated using (true) with check (true);

insert into public.info_categories (name, sort) values
  ('Surgical Protocol', 1),
  ('Surgical Technique', 2),
  ('מחקרים ומאמרים', 3),
  ('קטלוג ומוצרים', 4),
  ('מצגות', 5),
  ('סרטונים', 6),
  ('אחר', 7);

-- private bucket, 50 MB per file (Supabase free-plan limit)
insert into storage.buckets (id, name, public, file_size_limit)
values ('info-docs', 'info-docs', false, 52428800)
on conflict (id) do nothing;

create policy "info_docs_read" on storage.objects
  for select to authenticated using (bucket_id = 'info-docs');
create policy "info_docs_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'info-docs');
create policy "info_docs_delete_admin" on storage.objects
  for delete to authenticated using (bucket_id = 'info-docs' and public.is_admin());
