import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthProvider'
import { configError } from './lib/supabase'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
})

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
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  )
}
