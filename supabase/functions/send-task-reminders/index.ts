// Woken every minute by pg_cron (via public.trigger_task_reminders()): finds tasks whose reminder time has arrived
// and sends a real push notification to every device the assignee subscribed from. Authenticated by a shared
// secret (CRON_SECRET) rather than a user JWT — this function has no human caller, only the database itself.
// Needs the secrets VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT and CRON_SECRET (Supabase → Edge Functions → Secrets).
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  const auth = req.headers.get('Authorization') ?? ''
  if (auth !== `Bearer ${Deno.env.get('CRON_SECRET')}`) return new Response('unauthorized', { status: 401 })

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? 'mailto:support@example.com',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  )

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: due, error } = await supabase
    .from('meeting_tasks')
    .select('id, description, assignee_id')
    .lte('reminder_at', new Date().toISOString())
    .is('reminder_sent_at', null)
    .not('reminder_at', 'is', null)
    .eq('is_done', false)
    .not('assignee_id', 'is', null)
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  if (!due || due.length === 0) return new Response(JSON.stringify({ sent: 0, tasks: 0 }), { status: 200 })

  let sent = 0
  for (const task of due) {
    const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('user_id', task.assignee_id)
    const payload = JSON.stringify({ title: 'תזכורת למשימה', body: (task.description ?? '').slice(0, 120), taskId: task.id })
    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
        sent++
      } catch (e) {
        const statusCode = (e as { statusCode?: number } | null)?.statusCode
        if (statusCode === 404 || statusCode === 410) await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
    // marked sent even with zero subscriptions, so a task with notifications never enabled doesn't retry forever
    await supabase.from('meeting_tasks').update({ reminder_sent_at: new Date().toISOString() }).eq('id', task.id)
  }
  return new Response(JSON.stringify({ sent, tasks: due.length }), { status: 200 })
})
