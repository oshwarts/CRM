import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { OFFLINE_MESSAGE } from './offline'
import { awaitingRefresh, setAwaitingRefresh } from './offlineAuth'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configError: string | null =
  !url || !anonKey
    ? 'חסרים משתני סביבה VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. יש להגדיר אותם ב-Vercel (Project → Settings → Environment Variables) עבור סביבת Production ולבצע Redeploy.'
    : null

// opened from a password-reset link? (read before the client removes the token from the address)
export const openedFromResetLink = typeof window !== 'undefined' && /type=recovery/.test(window.location.hash)

// a call to the data (not to the sign-in service)
const isData = (input: RequestInfo | URL) => /\/(rest|storage|functions)\/v1\//.test(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)

// offline the app is read-only: any write fails immediately with a clear message instead of hanging

const offlineAwareFetch: typeof fetch = async (input, init) => {
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
  if (typeof navigator !== 'undefined' && !navigator.onLine && method !== 'GET' && method !== 'HEAD')
    return Promise.reject(Object.assign(new Error(OFFLINE_MESSAGE), { name: 'שגיאה' }))
  // opened from the saved session: wait for the real token (a few tries), or fail like a missing network, so that no empty answer reaches the screens
  if (awaitingRefresh() && navigator.onLine && isData(input)) {
    for (let i = 0; i < 4 && awaitingRefresh(); i++) {
      const { data } = await supabase.auth.getSession()
      if (data.session) setAwaitingRefresh(false)
      else await new Promise((r) => setTimeout(r, 1500))
    }
    if (awaitingRefresh()) throw new TypeError('Failed to fetch')
  }
  return fetch(input, init)
}

export const supabase = createClient<Database>(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder',
  {
    auth: { persistSession: true, autoRefreshToken: true },
    global: { fetch: offlineAwareFetch },
  },
)
