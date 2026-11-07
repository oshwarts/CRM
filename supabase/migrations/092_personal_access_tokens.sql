-- Personal access tokens: let an agent add a task hands-free (a Siri Shortcut / Android routine posts dictated text
-- to the voice-add-task edge function). Only a hash is ever stored — the raw token is shown once, at creation, and
-- never again. A token can only create a task for its own owner; it grants nothing else.
create table public.personal_access_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default '',
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index personal_access_tokens_user_idx on public.personal_access_tokens (user_id);
alter table public.personal_access_tokens enable row level security;
create policy personal_access_tokens_own on public.personal_access_tokens for all to authenticated
  using (user_id = public.effective_uid()) with check (user_id = public.effective_uid());
create policy active_users_only on public.personal_access_tokens as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));
