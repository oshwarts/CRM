import { useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { useAllUsers } from '../lib/api'

/** developer account only: switch to an existing user to see and try the system exactly as that user does */
export function DeveloperSwitcher() {
  const { isDeveloper, realProfile, impersonating, switchUser } = useAuth()
  const users = useAllUsers()
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
        {(users.data ?? [])
          .filter((u) => u.active && u.id !== realProfile?.id)
          .map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name || u.email} · {u.role === 'admin' ? 'מנהל' : 'סוכן'}
            </option>
          ))}
      </select>
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  )
}

/** the warning strip shown at the very top while switched to another user */
export function DeveloperBar() {
  const { impersonating, switchUser } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!impersonating) return null
  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex h-8 items-center justify-center gap-3 bg-amber-500 px-3 text-xs font-medium text-white shadow">
      <FlaskConical size={14} className="shrink-0" />
      <span className="truncate">
        מצב מפתח: אתה פועל כ-{impersonating.full_name || impersonating.email} — השינויים נשמרים באמת ומתועדים על שמך
      </span>
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
