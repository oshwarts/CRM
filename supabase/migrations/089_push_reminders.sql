-- Push reminders for tasks: a device subscribes once, then gets a real phone notification at the task's reminder time.
-- Sending happens server-side (an edge function, woken once a minute by pg_cron) so it works even with the app closed.

create extension if not exists pg_net;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy active_users_only on public.push_subscriptions as restrictive for all to authenticated
  using ((select public.is_active())) with check ((select public.is_active()));

alter table public.meeting_tasks
  add column reminder_at timestamptz,
  add column reminder_sent_at timestamptz;

-- rescheduling a reminder (even to the same value cleared then reset) makes it eligible to send again
create or replace function public.reset_reminder_sent()
returns trigger
language plpgsql
as $$
begin
  if new.reminder_at is distinct from old.reminder_at then
    new.reminder_sent_at := null;
  end if;
  return new;
end;
$$;
create trigger meeting_tasks_reminder_reset before update on public.meeting_tasks
  for each row execute function public.reset_reminder_sent();

-- woken every minute by pg_cron; calls the edge function that finds due reminders and sends the push.
-- the edge function's own URL is not secret, but the call must be authenticated, so the shared secret lives in Vault,
-- set once from the SQL editor (never committed to the repo): select vault.create_secret('<value>', 'cron_shared_secret');
create or replace function public.trigger_task_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  secret text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cron_shared_secret';
  if secret is null then return; end if;
  perform net.http_post(
    url := 'https://ajgmbytiuidjeiaklxdc.supabase.co/functions/v1/send-task-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
end;
$$;
revoke all on function public.trigger_task_reminders() from public, anon, authenticated;

select cron.schedule('send-task-reminders', '* * * * *', $$select public.trigger_task_reminders()$$);
