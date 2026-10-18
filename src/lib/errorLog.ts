// The error log of the app: an error that happens on somebody's screen is written to the database (the managers read it in the
// health page), so that a problem is known before somebody complains. At most a few lines per visit, and never the same one twice.
import { useEffect } from 'react'
import { supabase } from './supabase'

const MAX_PER_VISIT = 5
const seen = new Set<string>()

async function report(message: string, stack: string, version: string) {
  const key = message.slice(0, 160)
  if (seen.size >= MAX_PER_VISIT || seen.has(key) || !navigator.onLine) return
  seen.add(key)
  // a network failure is the connection, not a bug of the app
  if (/Failed to fetch|NetworkError|Load failed|offline|AbortError/i.test(message)) return
  const { data } = await supabase.auth.getSession()
  const uid = data.session?.user.id
  if (!uid) return
  await supabase
    .from('client_errors' as never)
    .insert({ user_id: uid, message: message.slice(0, 500), stack: stack.slice(0, 2000), url: location.pathname, user_agent: navigator.userAgent.slice(0, 200), app_version: version } as never)
}

/** for the places that catch an error themselves (the error boundary of a screen) */
export function reportClientError(message: string, stack: string, version: string) {
  void report(message, stack, version).catch(() => undefined)
}

export function useErrorLog(version: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const onError = (e: ErrorEvent) => void report(e.message || 'error', e.error?.stack ?? '', version).catch(() => undefined)
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason
      void report(r instanceof Error ? r.message : String(r?.message ?? r ?? 'rejection'), r instanceof Error ? (r.stack ?? '') : '', version).catch(() => undefined)
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [version, enabled])
}
