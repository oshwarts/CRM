import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './context/AuthProvider'
import Learn from './pages/Learn'
import './index.css'

const today = new Date().toISOString().slice(0, 10)
queryClient.setQueryData(['learn-topics'], [
  { id: 't1', title: 'JR101', description: 'שאלות קליניות', sort: 0, created_at: '2026-01-01', cards: 40 },
  { id: 't2', title: 'MAKO ברך', description: '', sort: 1, created_at: '2026-01-02', cards: 25 },
  { id: 't3', title: 'MAKO ירך', description: '', sort: 2, created_at: '2026-01-03', cards: 0 },
])
queryClient.setQueryData(['learn-tracks'], [
  { id: 'k1', title: 'סוכן חדש', description: '', audience: 'new', sort: 0, created_at: '', items: [
    { id: 'i1', track_id: 'k1', topic_id: 't1', sort: 0, pass_pct: 80, stage_id: null },
    { id: 'i2', track_id: 'k1', topic_id: 't2', sort: 1, pass_pct: 80, stage_id: null },
    { id: 'i3', track_id: 'k1', topic_id: 't3', sort: 2, pass_pct: 90, stage_id: null },
  ] },
])
queryClient.setQueryData(['learn-attempts', undefined], [{ id: 'a1', user_id: 'u', topic_id: 't1', score: 17, total: 20, taken_at: '2026-10-10T10:00:00Z' }])
queryClient.setQueryData(['learn-progress', undefined], [
  { id: 'p1', user_id: 'u', card_id: 'c1', topic_id: 't1', known: true, box: 1, due_on: today, correct_count: 1, wrong_count: 0, last_seen: '' },
  { id: 'p2', user_id: 'u', card_id: 'c2', topic_id: 't1', known: false, box: 0, due_on: today, correct_count: 0, wrong_count: 2, last_seen: '' },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <MemoryRouter>
      <AuthProvider>
        <div className="mx-auto max-w-xl p-4">
          <Learn />
        </div>
      </AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>,
)
