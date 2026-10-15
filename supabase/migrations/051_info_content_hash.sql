-- a fingerprint of an uploaded file, so the same file is not stored twice (library and learning module share it)
alter table public.info_documents add column if not exists content_hash text not null default '';
create index if not exists info_documents_hash_idx on public.info_documents (content_hash) where content_hash <> '';
