import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
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

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      setSession(next)
      if (next?.user) await loadProfile(next.user.id)
      else {
        setActingId(null)
        setImpersonating(null)
        setRealProfile(null)
      }
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
