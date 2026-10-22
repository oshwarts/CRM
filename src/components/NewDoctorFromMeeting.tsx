import { useMemo, useState } from 'react'
import { UserPlus, X } from 'lucide-react'
import { useCreateDoctor, useDoctors, useHospitals } from '../lib/api'
import { findDuplicateDoctors, normalizeHe } from '../lib/contactMatch'
import { unknownDoctors, type MentionedDoctor } from '../lib/meetingDoctors'
import { TITLES } from '../lib/types'
import { toast } from '../lib/toast'
import { classNames } from '../lib/utils'
import { Field, Modal } from './ui'

/**
 * Doctors named in what was written about the meeting who are not in the system: each one is offered ("add as a new doctor"), never
 * created by itself. Pressing the name of one opens the form to create him (the person chooses client / potential).
 */
export function UnknownDoctorsHint({ text, onCreate, dismissed, onDismiss }: { text: string; onCreate: (d: MentionedDoctor) => void; dismissed: ReadonlySet<string>; onDismiss: (name: string) => void }) {
  const doctors = useDoctors()
  const list = useMemo(() => (doctors.data ? unknownDoctors(text, doctors.data, dismissed) : []), [text, doctors.data, dismissed])
  if (list.length === 0) return null
  return (
    <div role="status" className="my-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
      <p className="mb-1.5 font-medium text-amber-900">רופא שלא קיים במערכת</p>
      <ul className="space-y-1.5">
        {list.map((m) => (
          <li key={m.name} className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1 basis-40 text-slate-800">
              {m.title} {m.name} מופיע בטקסט ואינו ברשימת הרופאים
            </span>
            <button type="button" className="btn-secondary !py-1 text-xs" onClick={() => onCreate(m)}>
              <UserPlus size={14} aria-hidden /> הקם רופא חדש
            </button>
            <button type="button" className="btn-ghost !px-2 text-xs" aria-label={`${m.name} אינו רופא או כבר קיים, התעלם`} title="התעלם" onClick={() => onDismiss(normalizeHe(m.name))}>
              <X size={14} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** a small form for a new doctor: name, title, client or potential (chosen, not assumed), the hospital of the meeting; created doctor goes back to the meeting */
export function NewDoctorFromMeeting({ initial, hospitalId, onClose, onCreated }: { initial: { title?: string; name: string }; hospitalId: string | null; onClose: () => void; onCreated: (id: string) => void }) {
  const create = useCreateDoctor()
  const doctors = useDoctors()
  const hospitals = useHospitals()
  const [name, setName] = useState(initial.name)
  const [title, setTitle] = useState<string>(initial.title === 'פרופ׳' ? 'פרופסור' : 'דוקטור')
  const [status, setStatus] = useState<'client' | 'potential' | ''>('')
  const [phone, setPhone] = useState('')
  const [linkHospital, setLinkHospital] = useState(!!hospitalId)
  const [error, setError] = useState('')
  const hospital = (hospitals.data ?? []).find((h) => h.id === hospitalId)
  const same = findDuplicateDoctors({ name, phone, email: '' }, doctors.data ?? [])

  function save() {
    if (!name.trim()) return setError('כתוב את שם הרופא')
    if (!status) return setError('בחר אם הרופא לקוח או פוטנציאלי')
    setError('')
    create.mutate(
      {
        name: name.trim(), title, position: '', phone: phone.trim(), email: '', notes: '', status, tracking_notes: '', pipeline_stage: '', next_step: '', next_step_date: null,
        contact_cadence_days: null, companyIds: [], procedureIds: [], roboticSystemIds: [],
        hospitals: linkHospital && hospitalId ? [{ hospital_id: hospitalId, role_at_hospital: '', sector: hospital?.sector ?? 'public', clinic_days: [], clinic_hours: '', clinic_note: '' }] : [],
      },
      {
        onSuccess: (d) => {
          toast(`הרופא ${name.trim()} נוסף למערכת ולפגישה`)
          onCreated(d.id)
        },
        onError: () => setError('ההקמה נכשלה, נסה שוב'),
      },
    )
  }

  return (
    <Modal open onClose={onClose} title="רופא חדש מהפגישה" size="md">
      <div className="space-y-3">
        <p className="text-sm text-slate-600">הרופא לא ברשימה. אפשר להקים אותו כאן, והוא יתווסף גם לפגישה.</p>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Field label="תואר">
            <select className="input" value={title} onChange={(e) => setTitle(e.target.value)}>
              {TITLES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="שם הרופא">
            <input className="input" dir="auto" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        <div>
          <p className="label">סטטוס</p>
          <div role="radiogroup" aria-label="סטטוס הרופא" className="grid grid-cols-2 gap-2">
            {([['client', 'לקוח'], ['potential', 'פוטנציאלי']] as const).map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={status === v} onClick={() => setStatus(v)} className={classNames('min-h-[44px] rounded-xl border text-sm font-medium', status === v ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <Field label="טלפון (לא חובה)">
          <input className="input" type="tel" dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        {hospital && (
          <label className="flex min-h-[40px] items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="h-5 w-5" checked={linkHospital} onChange={(e) => setLinkHospital(e.target.checked)} />
            לשייך אותו ל{hospital.name}
          </label>
        )}
        {same.length > 0 && (
          <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            דומה לרופא שכבר קיים: {same.slice(0, 2).map((x) => x.doctor.name).join(', ')}. כדאי לבחור אותו ברשימת המשתתפים במקום להקים רופא חדש.
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <button type="button" className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
          <button type="button" className="btn-primary max-sm:flex-1" disabled={create.isPending} onClick={save}>
            {create.isPending ? 'מקים…' : 'הקם והוסף לפגישה'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
