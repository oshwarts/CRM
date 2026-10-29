-- push_subscriptions_own used auth.uid(), unlike every other "own row" policy in the app (which use effective_uid()
-- so a developer impersonating another user acts, and is bound by RLS, as that user). Fixes a developer subscribing
-- to push notifications on an impersonated agent's behalf silently failing (RLS blocked the insert).
alter policy push_subscriptions_own on public.push_subscriptions
  using (user_id = public.effective_uid()) with check (user_id = public.effective_uid());
