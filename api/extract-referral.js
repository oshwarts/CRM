import mammoth from 'mammoth'
import { buildRequest, normalizeResult, pickToolInput } from './_referral.js'

// Receives a WhatsApp message and/or a referral file (PDF / Word), asks Claude to extract the
// patient and surgery details, and returns them. The API key never leaves the server.

const MAX_TEXT = 20000
const MAX_FILE_BASE64 = 4_200_000 // Vercel request bodies are capped at ~4.5 MB

const send = (res, status, body) => res.status(status).json(body)

async function verifyUser(token) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!token || !url || !anon) return false
  const r = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: anon } })
  return r.ok
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' })

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!(await verifyUser(token))) return send(res, 401, { error: 'unauthorized' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return send(res, 503, { error: 'not_configured' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const text = String(body.text ?? '').slice(0, MAX_TEXT).trim()
  const file = body.file && typeof body.file === 'object' ? body.file : null

  let pdfBase64 = ''
  let docxText = ''
  if (file) {
    const name = String(file.name || '').toLowerCase()
    const b64 = String(file.base64 || '')
    if (b64.length > MAX_FILE_BASE64) return send(res, 413, { error: 'file_too_large' })
    if (name.endsWith('.pdf') || file.type === 'application/pdf') {
      pdfBase64 = b64
    } else if (name.endsWith('.docx')) {
      try {
        docxText = (await mammoth.extractRawText({ buffer: Buffer.from(b64, 'base64') })).value.slice(0, MAX_TEXT)
      } catch {
        return send(res, 422, { error: 'unreadable_file' })
      }
    } else {
      return send(res, 415, { error: 'unsupported_file' })
    }
  }
  if (!text && !pdfBase64 && !docxText) return send(res, 400, { error: 'empty' })

  const request = buildRequest({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
    today: new Date().toISOString().slice(0, 10),
    text,
    pdfBase64,
    docxText,
  })

  let apiRes
  try {
    apiRes = await fetch(process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(request),
    })
  } catch {
    return send(res, 502, { error: 'ai_unreachable' })
  }
  if (!apiRes.ok) {
    const code = apiRes.status === 401 || apiRes.status === 403 ? 'bad_key' : apiRes.status === 429 ? 'rate_limited' : 'ai_error'
    return send(res, 502, { error: code })
  }

  const input = pickToolInput(await apiRes.json())
  if (!input) return send(res, 502, { error: 'no_result' })
  return send(res, 200, { extracted: normalizeResult(input) })
}
