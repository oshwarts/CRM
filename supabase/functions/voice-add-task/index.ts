// Hands-free task creation: a Siri Shortcut (or an Android routine) posts dictated text here with a personal access
// token in the Authorization header. No Supabase session involved — only a hash of the token is ever stored, so a
// leaked token can create tasks for its one owner and nothing else (checked here, never trusted from the client).
//
// Understands the doctor, hospital, due date and urgency the same way the app's own "quick add" does, via
// taskParse.ts next to this file — a hand-copied snapshot of src/lib/taskParse.ts (edge functions can't import
// from outside their own folder). If that file's parsing logic changes, re-copy it here too.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { guessTask } from './taskParse.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** today's date (Israel time), so a task dictated from the car lands on "today" instead of "no date" */
function todayIsrael(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date()).split('-').map(Number)
  return new Date(parts[0], parts[1] - 1, parts[2])
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return json({ error: 'missing token' }, 401)

  const body = await req.json().catch(() => ({}))
  const text = String(body.text ?? '').trim()
  if (!text) return json({ error: 'empty task text' }, 400)
  if (text.length > 500) return json({ error: 'text too long' }, 400)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const tokenHash = await sha256Hex(token)
  const { data: row } = await supabase.from('personal_access_tokens').select('id, user_id').eq('token_hash', tokenHash).maybeSingle()
  if (!row) return json({ error: 'invalid token' }, 401)

  const [{ data: doctors }, { data: hospitals }] = await Promise.all([
    supabase.from('doctors').select('id, name, title'),
    supabase.from('hospitals').select('id, name, city'),
  ])
  const today = todayIsrael()
  const guess = guessTask(text, { today, doctors: doctors ?? [], hospitals: hospitals ?? [] })

  const { error } = await supabase.from('meeting_tasks').insert({
    description: guess.description,
    due_date: guess.due_date ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(today),
    priority: guess.priority ?? 'normal',
    recurrence: guess.recurrence ?? 'none',
    doctor_id: guess.doctor_id,
    hospital_id: guess.hospital_id,
    category: 'work',
    assignee_id: row.user_id,
    created_by: row.user_id,
  })
  if (error) return json({ error: error.message }, 500)

  await supabase.from('personal_access_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', row.id)
  // read back what was understood, so Siri can say it out loud — confirmation matters when nothing is on screen
  const parts = [guess.description]
  for (const f of guess.found) parts.push(f.label)
  return json({ ok: true, message: `נוספה משימה: ${parts.join(' · ')}` })
})
