import { useEffect, useState } from 'react'
import { UserRound } from 'lucide-react'
import { useAppSetting, useSaveAppSetting } from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import { AMI_SECRETARY_KEY, looksLikeEmail, parseSecretary, stringifySecretary } from '../lib/scanCoordination'
import { toast } from '../lib/toast'
import { Field } from './ui'

/** the AMI secretary who coordinates the scans of private hospitals with them (one for the whole system) */
export function AmiSecretarySettings() {
  const { isAdmin } = useAuth()
  const setting = useAppSetting(AMI_SECRETARY_KEY)
  const save = useSaveAppSetting()
  const saved = parseSecretary(setting.data)
  const [name, setName] = useState(saved.name)
  const [phone, setPhone] = useState(saved.phone)
  const [email, setEmail] = useState(saved.email)
  const [error, setError] = useState('')
  useEffect(() => {
    setName(saved.name)
    setPhone(saved.phone)
    setEmail(saved.email)
  }, [saved.name, saved.phone, saved.email])
  const dirty = name.trim() !== saved.name || phone.trim() !== saved.phone || email.trim() !== saved.email

  function submit() {
    if (email.trim() && !looksLikeEmail(email)) return setError('כתובת המייל אינה תקינה')
    setError('')
    save.mutate({ key: AMI_SECRETARY_KEY, value: stringifySecretary({ name, phone, email }) }, { onSuccess: () => toast('נשמר'), onError: () => setError('השמירה נכשלה') })
  }

  return (
    <section className="card space-y-3 p-4" aria-label="מזכירת אמי לתיאום סריקות">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
        <UserRound size={16} aria-hidden /> מזכירת אמי לתיאום סריקות
      </h2>
      <p className="text-sm text-slate-500">בבית חולים פרטי הסוכן מעביר את פרטי המטופל אליה, והיא מתאמת מול בית החולים. מופיעה בטופס המטופל ובסריקות.</p>
      <form
        noValidate
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (isAdmin && dirty) submit()
        }}
      >
        <Field label="שם" className="sm:col-span-2">
          <input className="input" dir="auto" autoComplete="off" disabled={!isAdmin} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="טלפון">
          <input className="input" type="tel" inputMode="tel" dir="ltr" autoComplete="off" disabled={!isAdmin} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="מייל">
          <input className="input" type="email" inputMode="email" dir="ltr" autoComplete="off" disabled={!isAdmin} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-red-600 sm:col-span-2">
            {error}
          </p>
        )}
        {isAdmin ? (
          dirty && (
            <div className="flex justify-end sm:col-span-2">
              <button type="submit" className="btn-primary" disabled={save.isPending}>
                שמירה
              </button>
            </div>
          )
        ) : (
          <p className="text-xs text-slate-500 sm:col-span-2">רק מנהל יכול לשנות.</p>
        )}
      </form>
    </section>
  )
}
