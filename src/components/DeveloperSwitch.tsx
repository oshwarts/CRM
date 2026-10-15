import { useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { useSwitchableUsers } from '../lib/api'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'

/** developer account only: switch to an existing user to see and try the system exactly as that user does */
export function DeveloperSwitcher() {
  const { isDeveloper, realProfile, impersonating, switchUser } = useAuth()
  const users = useSwitchableUsers()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!isDeveloper) return null

  async function change(id: string) {
    setBusy(true)
    setError('')
    try {
      await switchUser(id || null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ההחלפה נכשלה')
      setBusy(false)
    }
  }

  return (
    <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
      <label className="flex items-center gap-1 text-[11px] font-medium text-amber-800">
        <FlaskConical size={12} /> מצב מפתח — עבור למשתמש
      </label>
      <select className="input mt-1 !py-1 text-xs" value={impersonating?.id ?? ''} disabled={busy} onChange={(e) => void change(e.target.value)}>
        <option value="">אני ({realProfile?.full_name || realProfile?.email})</option>
        <optgroup label="משתמשי בדיקה (פיקטיביים)">
          {(users.data ?? [])
            .filter((u) => u.is_test)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
        </optgroup>
        <optgroup label="משתמשים קיימים">
          {(users.data ?? [])
            .filter((u) => u.active && !u.is_test && u.id !== realProfile?.id)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name || u.email} · {u.role === 'admin' ? 'מנהל' : 'סוכן'}
              </option>
            ))}
        </optgroup>
      </select>
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  )
}

/** deletes everything the fictitious user created, after a confirmation */
async function resetTestUser(id: string): Promise<void> {
  if (!window.confirm('למחוק את כל מה שמשתמש הבדיקה יצר (משימות, פרויקטים, פגישות, רופאים, סריקות…)?')) return
  const { error } = await supabase.rpc('reset_test_user', { p_target: id })
  if (error) throw error
  await queryClient.invalidateQueries()
}

/** the warning strip shown at the very top while switched to another user */
export function DeveloperBar() {
  const { impersonating, switchUser } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!impersonating) return null
  return (
    <div
      className={`fixed inset-x-0 top-0 z-[60] flex h-8 items-center gap-2 px-3 text-xs font-medium text-white shadow ${
        // red while acting as a real colleague (the changes are real); amber for the fictitious test users
        impersonating.is_test ? 'bg-[#d98e0a]' : 'bg-[#c7403a]'
      }`}
    >
      <FlaskConical size={14} className="shrink-0" />
      {/* on a phone only the name fits: the explanation is for wider screens */}
      <span className="min-w-0 flex-1 truncate">
        {impersonating.is_test ? 'מצב מפתח: ' : 'פועל כ-'}
        <b>{impersonating.full_name || impersonating.email}</b>
        <span className="hidden sm:inline">
          {impersonating.is_test ? ' — משתמש פיקטיבי' : ' — השינויים נשמרים באמת ומתועדים על שמך'}
        </span>
      </span>
      {impersonating.is_test && (
        <button
          className="shrink-0 rounded bg-white/20 px-2 py-0.5 hover:bg-white/30 disabled:opacity-50"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setError('')
            try {
              await resetTestUser(impersonating.id)
            } catch (e) {
              setError(e instanceof Error ? e.message : 'האיפוס נכשל')
            }
            setBusy(false)
          }}
        >
          איפוס<span className="hidden sm:inline"> משתמש בדיקה</span>
        </button>
      )}
      <button
        className="shrink-0 rounded bg-white/20 px-2 py-0.5 hover:bg-white/30 disabled:opacity-50"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setError('')
          try {
            await switchUser(null)
          } catch (e) {
            setError(e instanceof Error ? e.message : 'נכשל')
            setBusy(false)
          }
        }}
      >
        חזרה אליי
      </button>
      {error && <span className="truncate text-amber-50">{error}</span>}
    </div>
  )
}
