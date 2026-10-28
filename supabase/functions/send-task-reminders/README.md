Edge function `send-task-reminders` (deployed to the project; source kept in the Supabase dashboard / deploy history, and in this file next to it).
Woken every minute by pg_cron (`public.trigger_task_reminders()`). Finds tasks whose `reminder_at` has arrived and
sends a real web-push notification to every device the assignee subscribed from, then marks the reminder sent.
No human caller — authenticated by the shared secret `CRON_SECRET`, not a user JWT (`verify_jwt` is off).

Secrets needed (Supabase → Edge Functions → Secrets):
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — the push key pair (the public half also goes in the frontend's `VITE_VAPID_PUBLIC_KEY`)
- `VAPID_SUBJECT` — a `mailto:` address, required by the push protocol
- `CRON_SECRET` — matches the Vault secret `cron_shared_secret` the database sends as `Authorization: Bearer <secret>`
