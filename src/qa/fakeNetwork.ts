// The fake network of the QA harness. Nothing leaves the browser:
//  - reads (GET) of the database fail like a dropped connection, so the seeded data on the screen is kept
//  - writes (POST/PATCH/DELETE/rpc/storage/functions) are RECORDED in window.__qa.requests and answered with success
// Tests read what was sent:  __qa.requests.filter(r => r.method === 'POST' && r.path.includes('/meeting_tasks'))
// Answer a call yourself:     __qa.handlers['POST /rest/v1/rpc/learn_submit_attempt'] = () => [{ o_score: 8, o_total: 10 }]

export type QaRequest = { method: string; url: string; path: string; body: unknown; headers: Record<string, string>; at: number }
type Handler = (req: QaRequest) => unknown

export type QaApi = {
  requests: QaRequest[]
  handlers: Record<string, Handler>
  /** forget the recorded requests */
  reset: () => void
  /** go offline / online: navigator.onLine and the window events */
  setOnline: (online: boolean) => void
  /** make every write fail with this message (null = succeed again) */
  failWrites: (message: string | null) => void
  /** (set by the harness) open a screen by in-app navigation */
  go?: (path: string) => Promise<void>
  /** (set by the harness) measure screens: overflow, bad texts, console errors, unnamed controls … — see smoke.tsx */
  smoke?: (paths: string[], opts?: { wait?: number }) => Promise<import('./smoke').SmokeRow[]>
}

declare global {
  interface Window {
    __qa: QaApi
  }
}

export function installFakeNetwork(opts: { offline?: boolean; slow?: boolean } = {}) {
  const realFetch = window.fetch.bind(window)
  let writeError: string | null = null
  let online = !opts.offline

  const qa: QaApi = {
    requests: [],
    handlers: {},
    reset: () => {
      qa.requests.length = 0
    },
    setOnline: (v) => {
      online = v
      window.dispatchEvent(new Event(v ? 'online' : 'offline'))
    },
    failWrites: (m) => {
      writeError = m
    },
  }
  window.__qa = qa
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online })

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const isSupabase = /\.supabase\.co\//.test(url) || /placeholder\.supabase\.co/.test(url)
    if (!isSupabase) return realFetch(input, init)
    if (opts.slow) await wait(900)

    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const u = new URL(url)
    const headers: Record<string, string> = {}
    new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined)).forEach((v, k) => (headers[k] = v))
    let body: unknown = null
    const raw = init?.body
    if (typeof raw === 'string') {
      try {
        body = JSON.parse(raw)
      } catch {
        body = raw
      }
    } else if (raw) body = `[${(raw as Blob).constructor?.name ?? 'binary'}]`

    // reads: a dropped connection (the cached / seeded data stays on the screen)
    if (method === 'GET' || method === 'HEAD') {
      if (!online) throw new TypeError('Failed to fetch')
      const key = `GET ${u.pathname}`
      const h = qa.handlers[key]
      if (h) return json(h({ method, url, path: u.pathname + u.search, body, headers, at: Date.now() }))
      throw new TypeError('Failed to fetch')
    }

    const req: QaRequest = { method, url, path: u.pathname + u.search, body, headers, at: Date.now() }
    if (!online) throw new TypeError('Failed to fetch')
    qa.requests.push(req)
    if (writeError) return json({ message: writeError, code: 'QA_FAIL' }, 400)

    const custom = qa.handlers[`${method} ${u.pathname}`]
    if (custom) return json(custom(req))

    if (u.pathname.startsWith('/storage/v1/')) {
      if (u.pathname.includes('/object/sign/')) return json({ signedURL: `${u.pathname.replace('/object/sign/', '/object/sign/')}?token=qa` })
      return json({ Key: u.pathname.split('/object/')[1] ?? 'qa' })
    }
    if (u.pathname.startsWith('/functions/v1/')) return json({})
    if (u.pathname.startsWith('/rest/v1/rpc/')) return json(null)
    const wantsObject = (headers['accept'] ?? '').includes('vnd.pgrst.object')
    if (method === 'DELETE') return new Response(null, { status: 204 })
    const rows = Array.isArray(body) ? body : body ? [body] : []
    const echo = (headers['prefer'] ?? '').includes('return=representation') || u.searchParams.has('select')
    if (!echo) return new Response(null, { status: method === 'POST' ? 201 : 204 })
    return json(wantsObject ? (rows[0] ?? {}) : rows, method === 'POST' ? 201 : 200)
  }
}
