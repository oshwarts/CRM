// Content editors / managers: drafts multiple-choice study questions from the text of a training document (Claude).
// The questions are returned to the app, shown to the editor and saved only as drafts that a manager approves.
// Needs the secret ANTHROPIC_API_KEY (Supabase → Edge Functions → Secrets). The document text is sent to Anthropic.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const MODEL = 'claude-sonnet-5-5'
const MAX_CHARS = 90_000

const TOOL = {
  name: 'submit_questions',
  description: 'Submit the multiple-choice study questions written from the document.',
  input_schema: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string', description: 'The question, self-contained, in the language of the document.' },
            correct: { type: 'string', description: 'The single correct answer.' },
            wrong: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3, description: 'Three plausible but wrong answers, similar in length and style to the correct one.' },
            explanation: { type: 'string', description: 'One or two sentences explaining why the answer is right, based on the document.' },
          },
          required: ['question', 'correct', 'wrong', 'explanation'],
        },
      },
    },
    required: ['questions'],
  },
}

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
    const { data: allowed } = await caller.rpc('can_edit_learning')
    if (allowed !== true) return json({ error: 'forbidden' }, 403)

    const key = Deno.env.get('ANTHROPIC_API_KEY')
    if (!key) return json({ error: 'not_configured' }, 503)

    const body = await req.json().catch(() => ({}))
    const text = String(body.text ?? '').slice(0, MAX_CHARS).trim()
    const count = Math.min(Math.max(Number(body.count) || 10, 3), 25)
    const topic = String(body.topic ?? '').slice(0, 200)
    if (text.length < 200) return json({ error: 'text_too_short' }, 400)

    const prompt =
      `You write study questions for sales and clinical-support agents of an orthopedic medical-device company (robotic joint replacement).\n` +
      (topic ? `Learning topic: ${topic}\n` : '') +
      `Write ${count} multiple-choice questions from the document below. Rules:\n` +
      `- Use ONLY facts stated in the document. Never add outside knowledge or invent numbers.\n` +
      `- Ask about things an agent really needs to know (indications, steps, parameters, contraindications, terminology, decisions), not trivia such as page numbers or authors.\n` +
      `- Each question must be understandable on its own, without "according to the text".\n` +
      `- One clearly correct answer; three wrong answers that are plausible and of similar length.\n` +
      `- Write in the language of the document (keep English medical terms as they are).\n` +
      `- Spread the questions over the whole document, no duplicates.\n\n` +
      `DOCUMENT:\n${text}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        tools: [TOOL],
        tool_choice: { type: 'tool', name: TOOL.name },
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return json({ error: 'ai_failed', status: res.status, detail: detail.slice(0, 300) }, 502)
    }
    const out = await res.json()
    const tool = (out.content ?? []).find((c: { type: string }) => c.type === 'tool_use')
    const questions = (tool?.input?.questions ?? []) as { question: string; correct: string; wrong: string[]; explanation: string }[]
    const clean = questions
      .filter((q) => q?.question && q?.correct && Array.isArray(q.wrong) && q.wrong.length >= 3)
      .map((q) => ({ question: q.question.trim(), correct: q.correct.trim(), wrong: q.wrong.slice(0, 3).map((w) => String(w).trim()), explanation: String(q.explanation ?? '').trim() }))
    return json({ questions: clean })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'failed' }, 500)
  }
})
