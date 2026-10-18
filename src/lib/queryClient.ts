import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { toast } from './toast'
import { CACHE_MAX_AGE, newVersionAvailable, OFFLINE_MESSAGE } from './offline'
import { ApprovalRequiredError } from './largeFiles'

// one client for the whole app (also used by the offline outbox to update the screen optimistically)
const RELOADED = 'ami.reloadedForUpdate'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    // a load error while a newer version of the app exists usually means this old version asks for something that changed
    onError: async () => {
      if (!navigator.onLine || sessionStorage.getItem(RELOADED)) return
      if (await newVersionAvailable()) {
        sessionStorage.setItem(RELOADED, '1')
        window.location.reload()
      }
    },
  }),
  // every save tells the user how it went: a short "saved" (not for background bookkeeping marked meta.silent) or what failed
  mutationCache: new MutationCache({
    onSuccess: (_d, _v, _c, mutation) => {
      if (!mutation.meta?.silent) toast('נשמר')
    },
    onError: (e, _v, _c, mutation) => {
      if (mutation.meta?.silent) return
      // a large file waits for a manager: not an error, the message says what to do
      if (e instanceof ApprovalRequiredError) return void toast(e.message, { kind: 'info', ms: 9000 })
      const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : ''
      toast(msg === OFFLINE_MESSAGE ? 'אין חיבור לרשת — השינוי לא נשמר' : msg ? `הפעולה נכשלה: ${msg}` : 'הפעולה נכשלה', { kind: 'error' })
    },
  }),
  defaultOptions: {
    // gcTime must be at least the age of the saved cache, or the saved data is dropped from memory first
    queries: {
      staleTime: 30_000,
      gcTime: CACHE_MAX_AGE,
      refetchOnWindowFocus: true,
      // the outbox is sent first when the connection returns, and only then the data is reloaded (see outbox.ts)
      refetchOnReconnect: false,
      retry: 1,
    },
    // offline a save is either queued by the outbox or fails at once (supabase.ts) — never waits in a hidden queue
    mutations: { networkMode: 'always' },
  },
})
