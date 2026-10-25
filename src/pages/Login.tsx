import { useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { BrandLogo } from '../components/BrandLogo'
import { PasswordInput } from '../components/PasswordInput'
import { useAuth } from '../context/AuthProvider'
import { supabase } from '../lib/supabase'

type Mode = 'signin' | 'signup' | 'forgot'
type FieldErrors = { name?: string; email?: string; password?: string }

const TITLES: Record<Mode, string> = { signin: 'ברוכים הבאים', forgot: 'שכחתי סיסמה', signup: 'יצירת משתמש חדש' }
const SUBTITLES: Record<Mode, string> = {
  signin: 'התחברות למערכת ניהול הלקוחות',
  forgot: 'נשלח אליך קישור לבחירת סיסמה חדשה',
  signup: 'הגישה נפתחת אחרי אישור מנהל',
}

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  function go(next: Mode) {
    setMode(next)
    setError(null)
    setInfo(null)
    setFieldErrors({})
  }

  /** our own messages (in Hebrew, under the field) instead of the browser's balloons */
  function validate(): FieldErrors {
    const e: FieldErrors = {}
    if (mode === 'signup' && !fullName.trim()) e.name = 'כתוב את השם המלא'
    if (!email.trim()) e.email = 'כתוב את כתובת המייל'
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'כתובת המייל אינה תקינה'
    if (mode !== 'forgot') {
      if (!password) e.password = 'כתוב סיסמה'
      else if (mode === 'signup' && password.length < 6) e.password = 'הסיסמה חייבת להכיל לפחות 6 תווים'
    }
    return e
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    setError(null)
    setInfo(null)
    const fe = validate()
    setFieldErrors(fe)
    if (fe.name || fe.email || fe.password) {
      const first = fe.name ? 'login-name' : fe.email ? 'login-email' : 'login-password'
      formRef.current?.querySelector<HTMLElement>(`#${first}`)?.focus()
      return
    }
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
      setError(err instanceof Error ? translateAuthError(err.message) : 'אירעה שגיאה')
    } finally {
      setBusy(false)
    }
  }

  const errText = (t?: string, id?: string) =>
    t ? (
      <p id={id} className="mt-1 text-xs font-medium text-red-600">
        {t}
      </p>
    ) : null
  const bad = (t?: string) => (t ? 'border-red-500 ring-2 ring-red-200' : '')

  return (
    <main className="grid min-h-full place-items-center bg-gradient-to-b from-[#00326d] via-[#0d4090] to-[#1863dc] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-5 flex justify-center">
          <BrandLogo size="lg" light />
        </div>
        <div className="card w-full p-5 shadow-pop sm:p-7">
          {mode === 'forgot' && (
            <button type="button" className="mb-2 inline-flex items-center gap-1 text-sm text-brand-600 hover:underline" onClick={() => go('signin')}>
              <ArrowRight size={16} aria-hidden />
              חזרה להתחברות
            </button>
          )}
          <div className="mb-5 flex flex-col items-center gap-1 text-center">
            <h1 className="text-2xl font-semibold">{TITLES[mode]}</h1>
            <p className="text-sm text-slate-500">{SUBTITLES[mode]}</p>
          </div>

          <form ref={formRef} onSubmit={submit} noValidate className="space-y-3">
            {mode === 'signup' && (
              <div>
                <label className="label" htmlFor="login-name">
                  שם מלא
                </label>
                <input
                  id="login-name"
                  className={`input ${bad(fieldErrors.name)}`}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  aria-invalid={fieldErrors.name ? true : undefined}
                  aria-describedby={fieldErrors.name ? 'login-name-err' : undefined}
                />
                {errText(fieldErrors.name, 'login-name-err')}
              </div>
            )}
            <div>
              <label className="label" htmlFor="login-email">
                אימייל
              </label>
              <input
                id="login-email"
                type="email"
                dir="ltr"
                className={`input ${bad(fieldErrors.email)}`}
                autoComplete="username"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint={mode === 'forgot' ? 'go' : 'next'}
                aria-invalid={fieldErrors.email ? true : undefined}
                aria-describedby={fieldErrors.email ? 'login-email-err' : undefined}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {errText(fieldErrors.email, 'login-email-err')}
            </div>
            {mode !== 'forgot' && (
              <div>
                <label className="label" htmlFor="login-password">
                  סיסמה
                </label>
                <PasswordInput
                  id="login-password"
                  value={password}
                  onChange={setPassword}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  enterKeyHint="go"
                  invalid={!!fieldErrors.password}
                  describedBy={fieldErrors.password ? 'login-password-err' : mode === 'signup' ? 'login-password-hint' : undefined}
                />
                {errText(fieldErrors.password, 'login-password-err')}
                {mode === 'signup' && !fieldErrors.password && (
                  <p id="login-password-hint" className="mt-1 text-xs text-slate-500">
                    לפחות 6 תווים.
                  </p>
                )}
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}
            {info && (
              <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                {info}
              </p>
            )}

            <button className="btn-primary w-full" disabled={busy}>
              {busy ? 'רגע…' : mode === 'signin' ? 'התחבר' : mode === 'forgot' ? 'שלח קישור' : 'הרשמה'}
            </button>
          </form>

          {mode === 'signin' && (
            <div className="mt-2 flex flex-col">
              <button type="button" className="min-h-[44px] w-full text-center text-sm text-slate-600 hover:underline" onClick={() => go('forgot')}>
                שכחתי סיסמה
              </button>
              <button type="button" className="min-h-[44px] w-full text-center text-sm text-brand-600 hover:underline" onClick={() => go('signup')}>
                אין לך משתמש? הרשמה
              </button>
            </div>
          )}
          {mode === 'signup' && (
            <button type="button" className="mt-2 min-h-[44px] w-full text-center text-sm text-brand-600 hover:underline" onClick={() => go('signin')}>
              כבר יש לך משתמש? התחברות
            </button>
          )}
        </div>
      </div>
    </main>
  )
}

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login')) return 'אימייל או סיסמה שגויים'
  if (m.includes('already registered')) return 'האימייל כבר רשום במערכת'
  if (m.includes('password')) return 'הסיסמה חייבת להכיל לפחות 6 תווים'
  if (m.includes('rate limit') || m.includes('too many')) return 'יותר מדי ניסיונות. נסה שוב בעוד כמה דקות.'
  if (m.includes('failed to fetch') || m.includes('network')) return 'אין חיבור לאינטרנט. הכניסה הראשונה במכשיר דורשת חיבור; אחרי שנכנסת פעם אחת האפליקציה נפתחת גם בלי אינטרנט. בדוק את החיבור ונסה שוב.'
  return msg
}
