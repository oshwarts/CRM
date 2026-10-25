// Opening the app without a network. The sign-in token of the phone is valid for an hour; after that the client has to ask the server for a
// new one, and without a network it answers "no session" — the app then showed the sign-in page and the person could not even open the data
// that is kept on the device. Here the saved session and the saved profile are used for the time the network is missing; when it is back
// the client refreshes the token by itself, and a token the server refuses still ends in the sign-in page.
import type { Session } from '@supabase/supabase-js'

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

const PROFILE_PREFIX = 'ami.profile.'

/** the session the supabase client keeps in the storage of the browser (its key is sb-<project>-auth-token) */
export function readStoredSession(store: Store): Session | null {
  try {
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i)
      if (!key || !/^sb-.+-auth-token$/.test(key)) continue
      const s = JSON.parse(store.getItem(key) ?? 'null') as Partial<Session> | null
      if (s && typeof s.refresh_token === 'string' && s.refresh_token && s.user?.id) return s as Session
    }
  } catch {
    /* damaged entry or no storage */
  }
  return null
}

/** did the call fail because the server could not be reached (not because the answer was "no")? */
export function isNetworkFailure(error: { name?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return error.name === 'AuthRetryableFetchError' || /fetch|network|timeout|load failed|offline/i.test(error.message ?? '')
}

/** the session to start with: the client's own; or, when the server cannot be reached, the saved one */
export function pickSession(fromClient: Session | null, error: { name?: string; message?: string } | null | undefined, stored: Session | null, online: boolean): Session | null {
  if (fromClient) return fromClient
  if (stored && (!online || isNetworkFailure(error))) return stored
  return null
}

export function cacheProfile(store: Store, userId: string, profile: unknown) {
  try {
    store.setItem(PROFILE_PREFIX + userId, JSON.stringify(profile))
  } catch {
    /* storage full / private mode: the profile is only a convenience */
  }
}

export function readCachedProfile<T>(store: Store, userId: string): T | null {
  try {
    const v = JSON.parse(store.getItem(PROFILE_PREFIX + userId) ?? 'null') as T | null
    return v && typeof v === 'object' ? v : null
  } catch {
    return null
  }
}

/** nothing of the person stays on the device after he signs out */
export function clearCachedProfiles(store: Store) {
  try {
    const keys: string[] = []
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i)
      if (k?.startsWith(PROFILE_PREFIX)) keys.push(k)
    }
    keys.forEach((k) => store.removeItem(k))
  } catch {
    /* no storage */
  }
}

// The app was opened with the saved session because the server could not be reached. Until the client has a real token again, a request to the
// data would be answered as an anonymous user — an empty list, not an error — and would replace the data kept on the device with nothing.
let awaiting = false
export const setAwaitingRefresh = (v: boolean) => {
  awaiting = v
}
export const awaitingRefresh = () => awaiting
