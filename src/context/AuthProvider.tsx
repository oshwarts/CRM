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

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [realProfile, setRealProfile] = useState<Profile | null>(null)
  const [impersonating, setImpersonating] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(openedFromResetLink)

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    let eff: Profile | null = null
    if (data?.is_developer && data.impersonating_id) {
      const r = await supabase.from('profiles').select('*').eq('id', data.impersonating_id).maybeSingle()
      eff = r.data ?? null
    }
    setActingId(eff?.id ?? null)
    setImpersonating(eff)
    setRealProfile(data ?? null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session?.user) await loadProfile(data.session.user.id)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
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

    return () => sub.subscription.unsubscribe()
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
      const { error } = await supabase.rpc('set_impersonation', { target: id })
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

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
