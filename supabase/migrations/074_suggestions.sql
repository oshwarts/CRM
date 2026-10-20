-- Suggestions for improving the system: any user writes one, it reaches the developer (the one profile marked is_developer), who answers with a status
create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default public.effective_uid() references public.profiles(id) on delete cascade,
  kind text not null default 'idea' check (kind in ('idea', 'problem')),
  body text not null check (length(btrim(body)) > 0 and length(body) <= 4000),
  page text not null default '',
  status text not null default 'new' check (status in ('new', 'seen', 'done', 'declined')),
  dev_note text not null default '',
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index suggestions_user_idx on public.suggestions (created_by, created_at desc);
create index suggestions_status_idx on public.suggestions (status) where status = 'new';

alter table public.suggestions enable row level security;
create policy suggestions_read on public.suggestions for select to authenticated
  using (created_by = public.effective_uid() or public.is_real_developer());
create policy suggestions_insert on public.suggestions for insert to authenticated
  with check (created_by = public.effective_uid() and status = 'new');
create policy suggestions_developer_update on public.suggestions for update to authenticated
  using (public.is_real_developer()) with check (public.is_real_developer());
create policy suggestions_developer_delete on public.suggestions for delete to authenticated
  using (public.is_real_developer());
create policy active_users_only on public.suggestions as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));
create trigger audit_suggestions after insert or update or delete on public.suggestions
  for each row execute function public.audit_row();
