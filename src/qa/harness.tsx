// QA harness: runs the real <App/> with a fake signed-in user, seeded data and a fake network (dev server only, see README.md).
//   /qa.html?path=/doctors&role=admin|agent|developer&empty=1&offline=1&slow=1
import './isolate'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { AuthContext } from '../context/AuthProvider'
import { ToastHost } from '../components/ToastHost'
import { queryClient } from '../lib/queryClient'
import { supabase } from '../lib/supabase'
import { installFakeNetwork } from './fakeNetwork'
import { QaBridge } from './smoke'
import { qaProfile } from './seed'
import '../index.css'
// the base data, then the seed of every page (src/qa/pages/*.seed.ts)
import './seed'
import.meta.glob('./pages/*.seed.ts', { eager: true })

const params = new URLSearchParams(window.location.search)
const role = (params.get('role') ?? 'admin') as 'admin' | 'agent' | 'developer'

installFakeNetwork({ offline: params.has('offline'), slow: params.has('slow') })

// seeded data must stay: nothing is asked from a server in this page
queryClient.setDefaultOptions({
  ...queryClient.getDefaultOptions(),
  queries: { ...queryClient.getDefaultOptions().queries, staleTime: Infinity, retry: false, refetchOnWindowFocus: false, refetchOnMount: false },
})

const me = qaProfile(role)
// ?as=test|real (developer): the developer acts as a fictitious test user / as a real colleague — the strip at the top of the screen
const as = params.get('as')
const acting = as ? ({ ...qaProfile('agent'), id: as === 'test' ? 'u-test' : 'u-real', full_name: as === 'test' ? 'סוכן פיקטיבי' : 'דנה מנהלת עם שם ארוך מאוד שצריך להיחתך בתפריט הבחירה', email: 'acting@qa.test', is_test: as === 'test' }) : null
// the outbox sends changes only for a signed-in account: give it the fake one (the fake network answers the writes)
supabase.auth.getSession = (async () => ({ data: { session: { user: { id: me.id } } }, error: null })) as never
const value = {
  session: { user: { id: me.id, email: me.email } },
  user: { id: (acting ?? me).id, email: (acting ?? me).email },
  profile: acting ?? me,
  realProfile: me,
  isDeveloper: role === 'developer',
  impersonating: acting,
  switchUser: async (id: string | null) => {
    ;((window as unknown as { __qaSwitched?: (string | null)[] }).__qaSwitched ??= []).push(id)
    if (id === null) window.location.replace(window.location.pathname + window.location.search.replace(/[?&]as=[^&]*/, ''))
  },
  recovering: false,
  setNewPassword: async () => {},
  loading: false,
  isAdmin: (acting ?? me).role === 'admin',
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
} as never

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[params.get('path') ?? '/']}>
        <AuthContext.Provider value={value}>
          <QaBridge />
          <App />
          <ToastHost />
        </AuthContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
