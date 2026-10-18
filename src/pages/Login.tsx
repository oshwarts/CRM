import { useState } from 'react'
import { BrandLogo } from '../components/BrandLogo'
import { useAuth } from '../context/AuthProvider'
import { supabase } from '../lib/supabase'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin')
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
      if (mode === 'forgot') {
        // the same answer whether or not the address exists: nobody can use the form to find out who has an account
        await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
        setInfo('אם הכתובת רשומה במערכת, נשלח אליה קישור לבחירת סיסמה חדשה. הקישור תקף לזמן קצר.')
      } else if (mode === 'signin') {
        await signIn(email.trim(), password)
      } else {
        await signUp(email.trim(), password, fullName.trim())
        setInfo('נרשמת בהצלחה. הגישה למערכת תיפתח לאחר אישור של מנהל. אם נדרש אישור מייל — בדוק את תיבת הדואר.')
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
    <div className="grid min-h-full place-items-center bg-gradient-to-b from-[#00326d] via-[#0d4090] to-[#1863dc] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <BrandLogo size="lg" light />
        </div>
      <div className="card w-full p-7 shadow-pop">
        <div className="mb-6 flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-semibold">{mode === 'signin' ? 'ברוכים הבאים' : mode === 'forgot' ? 'שכחתי סיסמה' : 'יצירת משתמש חדש'}</h1>
          <p className="text-sm text-slate-500">{mode === 'signin' ? 'התחברות למערכת ניהול הלקוחות' : 'הגישה נפתחת אחרי אישור מנהל'}</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'signup' && (
            <div>
              <label className="label">שם מלא</label>
              <input
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
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
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {mode !== 'forgot' && (
          <div>
            <label className="label">סיסמה</label>
            <input
              type="password"
              dir="ltr"
              className="input"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          )}

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
            {busy ? 'רגע…' : mode === 'signin' ? 'התחבר' : mode === 'forgot' ? 'שלח קישור' : 'הרשמה'}
          </button>
        </form>

        {mode === 'signin' && (
          <button
            type="button"
            className="mt-3 w-full text-center text-sm text-slate-600 hover:underline"
            onClick={() => {
              setMode('forgot')
              setError(null)
              setInfo(null)
            }}
          >
            שכחתי סיסמה
          </button>
        )}
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
            : mode === 'forgot'
              ? 'חזרה להתחברות'
              : 'כבר יש לך משתמש? התחברות'}
        </button>
      </div>
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
