import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'

/** shown after the user opened a password-reset link: choose a new password */
export default function SetPassword() {
  const { setNewPassword } = useAuth()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (pw.length < 8) return setError('הסיסמה צריכה להכיל לפחות 8 תווים')
    if (pw !== pw2) return setError('הסיסמאות אינן זהות')
    setBusy(true)
    try {
      await setNewPassword(pw)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'השמירה נכשלה')
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-full place-items-center bg-slate-50 p-4">
      <div className="card w-full max-w-sm p-7">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500 text-white">
            <KeyRound size={22} />
          </div>
          <h1 className="text-xl font-semibold text-brand-800">סיסמה חדשה</h1>
          <p className="text-sm text-slate-400">בחר סיסמה חדשה לחשבון שלך</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">סיסמה חדשה</label>
            <input type="password" dir="ltr" className="input" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} />
          </div>
          <div>
            <label className="label">הקלד שוב</label>
            <input type="password" dir="ltr" className="input" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required minLength={8} />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'שומר…' : 'שמור סיסמה'}
          </button>
        </form>
      </div>
    </div>
  )
}
