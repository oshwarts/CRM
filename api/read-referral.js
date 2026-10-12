import mammoth from 'mammoth'
import WordExtractor from 'word-extractor'
import { extractText, getDocumentProxy } from 'unpdf'

// Reads the text out of a referral file (.doc / .docx / .pdf). No AI and no third party:
// the file is processed in memory, returned to the signed-in user and never stored.

const MAX_FILE_BASE64 = 4_200_000 // Vercel request bodies are capped at ~4.5 MB
const MAX_TEXT = 30000

const send = (res, status, body) => res.status(status).json(body)

async function verifyUser(token) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!token || !url || !anon) return false
  const headers = { Authorization: `Bearer ${token}`, apikey: anon }
  const r = await fetch(`${url}/auth/v1/user`, { headers })
  if (!r.ok) return false
  // only approved (active) users — the profile is read with the caller's own token
  const { id } = await r.json()
  const p = await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=active`, { headers })
  if (!p.ok) return false
  const rows = await p.json()
  return rows[0]?.active === true
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' })

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!(await verifyUser(token))) return send(res, 401, { error: 'unauthorized' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const name = String(body.name || '').toLowerCase()
  const b64 = String(body.base64 || '')
  if (!b64) return send(res, 400, { error: 'empty' })
  if (b64.length > MAX_FILE_BASE64) return send(res, 413, { error: 'file_too_large' })
  const buffer = Buffer.from(b64, 'base64')

  try {
    let text = ''
    if (name.endsWith('.docx')) {
      text = (await mammoth.extractRawText({ buffer })).value
    } else if (name.endsWith('.doc')) {
      text = (await new WordExtractor().extract(buffer)).getBody()
    } else if (name.endsWith('.pdf')) {
      const pdf = await getDocumentProxy(new Uint8Array(buffer))
      text = (await extractText(pdf, { mergePages: true })).text
    } else {
      return send(res, 415, { error: 'unsupported_file' })
    }
    return send(res, 200, { text: String(text).slice(0, MAX_TEXT) })
  } catch {
    return send(res, 422, { error: 'unreadable_file' })
  }
}
