import { QueryCache, QueryClient } from '@tanstack/react-query'
import { CACHE_MAX_AGE, newVersionAvailable } from './offline'

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
