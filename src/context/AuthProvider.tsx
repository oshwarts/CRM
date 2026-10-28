import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { openedFromResetLink, supabase } from '../lib/supabase'
import { setActingId } from '../lib/actingAs'
import { outboxSize } from '../lib/outbox'
import { queryClient } from '../lib/queryClient'
import { idbPersister } from '../lib/offline'
import type { Profile } from '../lib/types'
import { cacheProfile, pickSession, readCachedProfile, readStoredSession, setAwaitingRefresh } from '../lib/offlineAuth'

// a call to the server that never answers must not keep the app on the loading screen
const WAIT_MS = 8000
const timeoutSignal = () => (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(WAIT_MS) : undefined)

type AuthContextValue = {
  session: Session | null
  user: User | null
  /** who the app currently acts as: the signed-in user, or the user the developer is switched to */
  profile: Profile | null
  /** the signed-in account itself */
  realProfile: Profile | null
  isDeveloper: boolean
  /** set while the developer is switched to another user */
  impersonating: Profile | null
  switchUser: (id: string | null) => Promise<void>
  /** true after the user opened a password-reset link, until a new password is chosen */
  recovering: boolean
  setNewPassword: (password: string) => Promise<void>
  loading: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [realProfile, setRealProfile] = useState<Profile | null>(null)
  const [impersonating, setImpersonating] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(openedFromResetLink)

  async function loadProfile(userId: string) {
    // without a network the profile saved on this device is used (the role decides what the screens show; the server still decides what is allowed)
    let data: Profile | null = null
    let unreachable = false
    try {
      const q = supabase.from('profiles').select('*').eq('id', userId)
      const sig = timeoutSignal()
      const r = await (sig ? q.abortSignal(sig) : q).maybeSingle()
      if (r.error) unreachable = true
      else data = r.data
    } catch {
      unreachable = true
    }
    if (unreachable || (!data && !navigator.onLine)) data = readCachedProfile<Profile>(localStorage, userId)
    else if (data) cacheProfile(localStorage, userId, data)

    let eff: Profile | null = null
    if (data?.is_developer && data.impersonating_id) {
      try {
        const r = await supabase.from('profiles').select('*').eq('id', data.impersonating_id).maybeSingle()
        eff = r.error ? readCachedProfile<Profile>(localStorage, data.impersonating_id) : (r.data ?? null)
        if (r.data) cacheProfile(localStorage, data.impersonating_id, r.data)
      } catch {
        eff = readCachedProfile<Profile>(localStorage, data.impersonating_id)
      }
    }
    setActingId(eff?.id ?? null)
    setImpersonating(eff)
    setRealProfile(data)
  }

  useEffect(() => {
    // the saved session opens the app also when the server cannot be reached (an hour-old token cannot be renewed without a network)
    const waited = new Promise<{ data: { session: null }; error: { message: string } }>((res) => setTimeout(() => res({ data: { session: null }, error: { message: 'timeout' } }), WAIT_MS))
    Promise.race([supabase.auth.getSession(), waited]).then(async ({ data, error }) => {
      const start = pickSession(data.session, error, readStoredSession(localStorage), navigator.onLine)
      setSession(start)
      setAwaitingRefresh(!!start && start !== data.session) // the saved session stands in until the client renews the token
      if (start?.user) await loadProfile(start.user.id)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (next) setAwaitingRefresh(false)
      setSession(next)
      // supabase calls made straight inside this callback can deadlock the client: continue on the next tick
      setTimeout(() => {
        if (next?.user) void loadProfile(next.user.id)
        else {
          setActingId(null)
          setImpersonating(null)
          setRealProfile(null)
        }
      }, 0)
    })

    // the network is back: renew the token at once (otherwise it happens at the next tick of the client)
    const onOnline = () => void supabase.auth.getSession()
    window.addEventListener('online', onOnline)

    return () => {
      sub.subscription.unsubscribe()
      window.removeEventListener('online', onOnline)
    }
  }, [])

  const profile = impersonating ?? realProfile
  const value: AuthContextValue = {
    session,
    // while switched, the screens (assignee defaults, "my tasks" …) work with the user being tested
    user: session?.user ? (impersonating ? { ...session.user, id: impersonating.id, email: impersonating.email } : session.user) : null,
    profile,
    realProfile,
    isDeveloper: realProfile?.is_developer === true,
    impersonating,
    async switchUser(id) {
      if (!realProfile?.is_developer) return
      if (outboxSize() > 0) throw new Error('יש שינויים שממתינים לשליחה — המתן לסנכרון לפני החלפת משתמש')
      // the database function accepts NULL (clears impersonation) even though its uuid parameter type looks non-nullable here
      const { error } = await supabase.rpc('set_impersonation', { target: id as string })
      if (error) throw error
      // nothing of the previous user stays on the device: start the app again as the new user
      queryClient.clear()
      await idbPersister.removeClient()
      window.location.assign('/')
    },
    recovering,
    async setNewPassword(password) {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setRecovering(false)
      // the link's address (with its token) is replaced by the app's home
      window.history.replaceState(null, '', '/')
    },
    loading,
    isAdmin: profile?.role === 'admin',
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    async signUp(email, password, fullName) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (error) throw error
    },
    async signOut() {
      await supabase.auth.signOut()
    },
    async refreshProfile() {
      if (session?.user) await loadProfile(session.user.id)
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
