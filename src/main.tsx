import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthProvider'
import { configError, supabase } from './lib/supabase'
import { CACHE_BUSTER, CACHE_MAX_AGE, idbPersister, registerServiceWorker } from './lib/offline'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    // gcTime must be at least the age of the saved cache, or the saved data is dropped from memory first
    queries: { staleTime: 30_000, gcTime: CACHE_MAX_AGE, refetchOnWindowFocus: true, retry: 1 },
    // offline a save must fail at once (supabase.ts) instead of waiting in a hidden queue
    mutations: { networkMode: 'always' },
  },
})

// data kept on the device for offline reading is wiped as soon as the user signs out
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    queryClient.clear()
    void idbPersister.removeClient()
  }
})
registerServiceWorker()
if (import.meta.env.DEV) (window as unknown as { __qc: QueryClient }).__qc = queryClient

const root = ReactDOM.createRoot(document.getElementById('root')!)

if (configError) {
  root.render(
    <div
      style={{
        maxWidth: 480,
        margin: '15vh auto',
        padding: 24,
        borderRadius: 16,
        background: '#fff',
        border: '1px solid #e2e8f0',
        fontFamily: 'Rubik, system-ui, sans-serif',
        textAlign: 'center',
        lineHeight: 1.6,
      }}
    >
      <h1 style={{ fontSize: 18, color: '#1f2937' }}>שגיאת הגדרה</h1>
      <p style={{ color: '#64748b', fontSize: 14 }}>{configError}</p>
    </div>,
  )
} else {
  root.render(
    <React.StrictMode>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: idbPersister,
          maxAge: CACHE_MAX_AGE,
          buster: CACHE_BUSTER,
          dehydrateOptions: {
            // admin audit log is not worth keeping on a device
            shouldDehydrateQuery: (q) => q.state.status === 'success' && q.queryKey[0] !== 'audit-log',
          },
        }}
      >
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </PersistQueryClientProvider>
    </React.StrictMode>,
  )
}
