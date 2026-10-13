import { useSyncExternalStore } from 'react'
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'

/* ---------- offline reading ----------
   The data the user already loaded is kept on the device (IndexedDB) so the app can show it without a network.
   Writing without a network is not supported: such requests fail at once with a clear message (see supabase.ts). */

export const OFFLINE_MESSAGE = 'אין חיבור לרשת — אפשר לצפות בנתונים אך לא לשמור שינויים. נסה שוב כשהחיבור חוזר.'
export const CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 7 // a week
/** bump to throw away every saved cache after a change of data shape */
export const CACHE_BUSTER = 'v1'

const DB = 'ami-offline'
const STORE = 'kv'
const KEY = 'query-cache'

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
      if (!req.result.objectStoreNames.contains('outbox')) req.result.createObjectStore('outbox')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const r = run(db.transaction(STORE, mode).objectStore(STORE))
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

/** saves the React Query cache in IndexedDB; every failure is swallowed — offline reading is a bonus, never a blocker */
export const idbPersister: Persister = {
  persistClient: async (client: PersistedClient) => {
    try {
      await tx('readwrite', (s) => s.put(client, KEY))
    } catch {
      // storage full / private mode
    }
  },
  restoreClient: async () => {
    try {
      return (await tx<PersistedClient | undefined>('readonly', (s) => s.get(KEY))) ?? undefined
    } catch {
      return undefined
    }
  },
  removeClient: async () => {
    try {
      await tx('readwrite', (s) => s.delete(KEY))
    } catch {
      // ignore
    }
  },
}

/** is the device online right now (reacts to going offline / back online) */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('online', cb)
      window.addEventListener('offline', cb)
      return () => {
        window.removeEventListener('online', cb)
        window.removeEventListener('offline', cb)
      }
    },
    () => navigator.onLine,
    () => true,
  )
}

/** installs the service worker (production only) so the app opens without a network */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`/sw.js?v=${__BUILD_ID__}`).catch(() => {
      // not critical
    })
  })
}

/** is a newer build of the app deployed? (compares the script hash in index.html with the running one) */
export async function newVersionAvailable(): Promise<boolean> {
  try {
    const running = [...document.scripts].map((s) => s.src.match(/assets\/(index-[\w-]+\.js)/)?.[1]).find(Boolean)
    if (!running) return false
    const html = await (await fetch('/index.html', { cache: 'no-store' })).text()
    const latest = html.match(/assets\/(index-[\w-]+\.js)/)?.[1]
    return !!latest && latest !== running
  } catch {
    return false
  }
}
