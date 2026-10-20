// QA harness: runs the real <App/> with a fake signed-in user, seeded data and a fake network (dev server only, see README.md).
//   /qa.html?path=/doctors&role=admin|agent|developer&empty=1&offline=1&slow=1
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { AuthContext } from '../context/AuthProvider'
import { ToastHost } from '../components/ToastHost'
import { queryClient } from '../lib/queryClient'
import { installFakeNetwork } from './fakeNetwork'
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
const value = {
  session: { user: { id: me.id, email: me.email } },
  user: { id: me.id, email: me.email },
  profile: me,
  realProfile: me,
  isDeveloper: role === 'developer',
  impersonating: null,
  switchUser: async () => {},
  recovering: false,
  setNewPassword: async () => {},
  loading: false,
  isAdmin: me.role === 'admin',
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
          <App />
          <ToastHost />
        </AuthContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
