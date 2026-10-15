import React from 'react'
import ReactDOM from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthProvider'
import { configError, supabase } from './lib/supabase'
import { CACHE_BUSTER, CACHE_MAX_AGE, idbPersister, registerServiceWorker } from './lib/offline'
import { queryClient } from './lib/queryClient'
import { ToastHost } from './components/ToastHost'
import './index.css'

// data kept on the device for offline reading is wiped as soon as the user signs out
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    queryClient.clear()
    void idbPersister.removeClient()
    // unsaved form drafts belong to the person who wrote them, not to the next one using this device
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('ami.draft.')) localStorage.removeItem(k)
    } catch {
      // no storage
    }
  }
})
registerServiceWorker()
// asks the browser not to evict the saved data / unsent changes when the device runs low on space (Safari clears unused sites)
void navigator.storage?.persist?.().catch(() => undefined)
if (import.meta.env.DEV) (window as unknown as { __qc: typeof queryClient }).__qc = queryClient

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
            shouldDehydrateQuery: (q) => q.state.status === 'success' && q.queryKey[0] !== 'audit-log' && q.queryKey[0] !== 'doc-text',
          },
        }}
      >
        <BrowserRouter>
          <AuthProvider>
            <App />
            <ToastHost />
          </AuthProvider>
        </BrowserRouter>
      </PersistQueryClientProvider>
    </React.StrictMode>,
  )
}
