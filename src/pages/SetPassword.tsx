import { useRef, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { PasswordInput } from '../components/PasswordInput'
import { useAuth } from '../context/AuthProvider'

/** shown after the user opened a password-reset link: choose a new password */
export default function SetPassword() {
  const { setNewPassword } = useAuth()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [errors, setErrors] = useState<{ pw?: string; pw2?: string; form?: string }>({})
  const [busy, setBusy] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (pw.length < 8) next.pw = 'הסיסמה צריכה להכיל לפחות 8 תווים'
    if (pw2 !== pw) next.pw2 = 'הסיסמאות אינן זהות'
    setErrors(next)
    if (next.pw || next.pw2) {
      formRef.current?.querySelector<HTMLElement>(next.pw ? '#sp-new' : '#sp-again')?.focus()
      return
    }
    setBusy(true)
    try {
      await setNewPassword(pw)
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'השמירה נכשלה' })
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-full place-items-center bg-slate-50 p-4">
      <div className="card w-full max-w-sm p-5 sm:p-7">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500 text-white">
            <KeyRound size={22} aria-hidden />
          </div>
          <h1 className="text-xl font-semibold text-brand-800">סיסמה חדשה</h1>
          <p className="text-sm text-slate-500">בחר סיסמה חדשה לחשבון שלך</p>
        </div>
        <form ref={formRef} onSubmit={submit} noValidate className="space-y-3">
          <div>
            <label className="label" htmlFor="sp-new">
              סיסמה חדשה
            </label>
            <PasswordInput id="sp-new" value={pw} onChange={setPw} autoComplete="new-password" enterKeyHint="next" invalid={!!errors.pw} describedBy={errors.pw ? 'sp-new-err' : 'sp-new-hint'} />
            {errors.pw ? (
              <p id="sp-new-err" className="mt-1 text-xs font-medium text-red-600">
                {errors.pw}
              </p>
            ) : (
              <p id="sp-new-hint" className="mt-1 text-xs text-slate-500">
                לפחות 8 תווים.
              </p>
            )}
          </div>
          <div>
            <label className="label" htmlFor="sp-again">
              הקלד שוב
            </label>
            <PasswordInput id="sp-again" value={pw2} onChange={setPw2} autoComplete="new-password" enterKeyHint="go" invalid={!!errors.pw2} describedBy={errors.pw2 ? 'sp-again-err' : undefined} />
            {errors.pw2 && (
              <p id="sp-again-err" className="mt-1 text-xs font-medium text-red-600">
                {errors.pw2}
              </p>
            )}
          </div>
          {errors.form && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {errors.form}
            </p>
          )}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'שומר…' : 'שמור סיסמה'}
          </button>
        </form>
      </div>
    </main>
  )
}
