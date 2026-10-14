// Manager-only: creates a one-time password-reset link for a user. The manager passes the link on to the user;
// nobody (including the manager) ever sees or chooses the new password. Every use is written to the audit log.
import { createClient } from 'npm:@supabase/supabase-js@2'

const ALLOWED_ORIGINS = ['https://crm-a5ak.vercel.app', 'http://localhost:5173']
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: me } = await caller.auth.getUser()
    if (!me.user) return json({ error: 'unauthorized' }, 401)
    const { data: isAdmin } = await caller.rpc('is_admin')
    if (isAdmin !== true) return json({ error: 'forbidden' }, 403)

    const body = await req.json().catch(() => ({}))
    const userId = String(body.user_id ?? '')
    const origin = ALLOWED_ORIGINS.includes(String(body.origin ?? '')) ? String(body.origin) : ALLOWED_ORIGINS[0]
    if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: 'bad user id' }, 400)

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: target } = await admin.from('profiles').select('id, email, full_name, is_test, is_developer').eq('id', userId).maybeSingle()
    if (!target || target.is_test) return json({ error: 'user not found' }, 404)
    // the developer account cannot be taken over by someone else
    if (target.is_developer && target.id !== me.user.id) return json({ error: 'not allowed for this account' }, 403)

    const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email: target.email, options: { redirectTo: origin } })
    if (error || !data?.properties?.action_link) return json({ error: error?.message ?? 'could not create link' }, 500)

    const { data: actor } = await admin.from('profiles').select('full_name').eq('id', me.user.id).maybeSingle()
    await admin.from('audit_log').insert({
      user_id: me.user.id,
      user_name: actor?.full_name ?? '',
      table_name: 'profiles',
      action: 'update',
      record_id: target.id,
      label: target.full_name || target.email,
      changed_fields: ['password_reset_link'],
    })
    return json({ link: data.properties.action_link, email: target.email, name: target.full_name })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'failed' }, 500)
  }
})
