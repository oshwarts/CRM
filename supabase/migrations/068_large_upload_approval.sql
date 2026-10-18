-- Large files (over 25 MB) need a manager's approval.
-- * The normal bucket (info-docs) now takes files up to 25 MB — enforced by Storage itself.
-- * A second bucket (info-docs-large, up to 50 MB, the most the plan allows) takes the bigger ones: managers directly, everybody else
--   only while they have an approved request.
-- * A request is made by the person who picks the file (request_large_upload), the managers approve or reject it (upload_requests),
--   the person uploads the file again and the request is closed (finish_large_upload).

create table public.upload_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null default public.effective_uid() references public.profiles(id) on delete cascade,
  file_name text not null,
  file_size bigint not null,
  purpose text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'used')),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  decision_note text not null default '',
  created_at timestamptz not null default now()
);
create index upload_requests_user_idx on public.upload_requests (requested_by, created_at desc);
create index upload_requests_decided_by_idx on public.upload_requests (decided_by);
create index upload_requests_status_idx on public.upload_requests (status) where status in ('pending', 'approved');

alter table public.upload_requests enable row level security;
create policy upload_requests_read on public.upload_requests for select to authenticated
  using (requested_by = public.effective_uid() or public.is_admin());
create policy upload_requests_admin_decide on public.upload_requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy active_users_only on public.upload_requests as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));
create trigger audit_upload_requests after insert or update or delete on public.upload_requests
  for each row execute function public.audit_row();

-- a request for a large file: returns the state of the latest request for this file by this person
create or replace function public.request_large_upload(p_name text, p_size bigint, p_purpose text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.effective_uid();
  r public.upload_requests;
begin
  if me is null or not public.is_active() then raise exception 'not allowed'; end if;
  select * into r from public.upload_requests
   where requested_by = me and file_name = p_name and file_size = p_size and status <> 'used'
   order by created_at desc limit 1;
  if found then
    return jsonb_build_object('state', r.status, 'id', r.id, 'note', r.decision_note);
  end if;
  insert into public.upload_requests (requested_by, file_name, file_size, purpose)
  values (me, left(p_name, 300), p_size, left(coalesce(p_purpose, ''), 300))
  returning * into r;
  return jsonb_build_object('state', 'created', 'id', r.id, 'note', '');
end;
$$;

-- the upload succeeded: the approval is used up
create or replace function public.finish_large_upload(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.upload_requests set status = 'used'
   where id = p_id and requested_by = public.effective_uid() and status = 'approved';
$$;

revoke all on function public.request_large_upload(text, bigint, text) from public, anon;
revoke all on function public.finish_large_upload(uuid) from public, anon;
grant execute on function public.request_large_upload(text, bigint, text) to authenticated;
grant execute on function public.finish_large_upload(uuid) to authenticated;

-- the buckets
update storage.buckets set file_size_limit = 26214400 where id = 'info-docs';
insert into storage.buckets (id, name, public, file_size_limit)
values ('info-docs-large', 'info-docs-large', false, 52428800)
on conflict (id) do update set file_size_limit = excluded.file_size_limit, public = false;

create policy info_docs_large_read on storage.objects for select to authenticated
  using (bucket_id = 'info-docs-large');
create policy info_docs_large_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'info-docs-large'
    and (public.is_admin() or exists (select 1 from public.upload_requests r where r.requested_by = public.effective_uid() and r.status = 'approved'))
  );
create policy info_docs_large_delete on storage.objects for delete to authenticated
  using (bucket_id = 'info-docs-large' and public.is_admin());
