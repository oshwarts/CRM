import { useState } from 'react'
import { Stethoscope } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password)
      } else {
        await signUp(email.trim(), password, fullName.trim())
        setInfo('נרשמת בהצלחה. אם נדרש אישור מייל — בדוק את תיבת הדואר, אחרת התחבר.')
        setMode('signin')
      }
    } catch (err) {
      setError(
        err instanceof Error ? translateAuthError(err.message) : 'אירעה שגיאה',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-full place-items-center bg-slate-50 p-4">
      <div className="card w-full max-w-sm p-7">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500 text-white">
            <Stethoscope size={22} />
          </div>
          <h1 className="text-xl font-bold text-slate-800">A.M.I. CRM</h1>
          <p className="text-sm text-slate-400">
            {mode === 'signin' ? 'התחברות למערכת' : 'יצירת משתמש חדש'}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'signup' && (
            <div>
              <label className="label">שם מלא</label>
              <input
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          )}
          <div>
            <label className="label">אימייל</label>
            <input
              type="email"
              dir="ltr"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">סיסמה</label>
            <input
              type="password"
              dir="ltr"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          {info && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              {info}
            </p>
          )}

          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'רגע…' : mode === 'signin' ? 'התחבר' : 'הרשמה'}
          </button>
        </form>

        <button
          className="mt-4 w-full text-center text-sm text-brand-600 hover:underline"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError(null)
            setInfo(null)
          }}
        >
          {mode === 'signin'
            ? 'אין לך משתמש? הרשמה'
            : 'כבר יש לך משתמש? התחברות'}
        </button>
      </div>
    </div>
  )
}

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login')) return 'אימייל או סיסמה שגויים'
  if (m.includes('already registered')) return 'האימייל כבר רשום במערכת'
  if (m.includes('password')) return 'הסיסמה חייבת להכיל לפחות 6 תווים'
  return msg
}
