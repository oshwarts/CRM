import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BookUser, FileUp, Sparkles } from 'lucide-react'
import {
  useContacts,
  useCreateDoctor,
  useDoctors,
  useHospitals,
  usePatchDoctorContact,
  useUpsertContact,
} from '../lib/api'
import {
  canPickContacts,
  parseVcard,
  pickFromDevice,
  type Candidate,
} from '../lib/contactImport'
import { stripTitle, suggest, type Destination } from '../lib/contactMatch'
import { CONTACT_ROLES, DOCTOR_STATUS_LABELS } from '../lib/types'
import { classNames } from '../lib/utils'
import { Modal } from './ui'

const DEST_LABEL: Record<Destination, string> = {
  doctor_update: 'עדכון הטלפון / המייל של רופא קיים',
  doctor_contact: 'איש קשר של רופא (מזכירה, עוזר, אחות…)',
  hospital_contact: 'איש קשר של בית חולים',
  new_doctor: 'רופא חדש',
  free_contact: 'איש קשר כללי (ללא שיוך)',
}

const digits = (s: string) => s.replace(/\D/g, '')

export function SmartContactImport({ onClose }: { onClose: () => void }) {
  const doctors = useDoctors()
  const hospitals = useHospitals()
  const contacts = useContacts()
  const patchDoctor = usePatchDoctorContact()
  const upsertContact = useUpsertContact()
  const createDoctor = useCreateDoctor()
  const fileRef = useRef<HTMLInputElement>(null)

  const [cands, setCands] = useState<Candidate[]>([])
  const [ci, setCi] = useState(0)
  const [chosen, setChosen] = useState(false)
  const [msg, setMsg] = useState('')

  // working copy of the contact being filed
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [dest, setDest] = useState<Destination>('free_contact')
  const [doctorId, setDoctorId] = useState('')
  const [hospitalId, setHospitalId] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('potential')
  const [setPhoneOn, setSetPhoneOn] = useState(true)
  const [setEmailOn, setSetEmailOn] = useState(true)
  const [reasons, setReasons] = useState<string[]>([])
  const [recommended, setRecommended] = useState<Destination | null>(null)
  const [done, setDone] = useState('')
  const [error, setError] = useState('')

  const docList = doctors.data ?? []
  const hospList = hospitals.data ?? []

  function choose(c: Candidate, tel: string, mail: string) {
    const s = suggest(
      c.name,
      docList.map((d) => ({ id: d.id, name: d.name, title: d.title, phone: d.phone, email: d.email })),
      hospList.map((h) => ({ id: h.id, name: h.name, city: h.city })),
    )
    setName(c.name)
    setPhone(tel)
    setEmail(mail)
    setDest(s.destination)
    setRecommended(s.destination)
    setDoctorId(s.doctorId)
    setHospitalId(s.hospitalId)
    setRole(s.role)
    setReasons(s.reasons)
    setSetPhoneOn(!!tel)
    setSetEmailOn(!!mail)
    setChosen(true)
    setDone('')
    setError('')
  }

  function offer(list: Candidate[]) {
    setMsg('')
    if (list.length === 0) return setMsg('לא נמצא איש קשר בבחירה.')
    setCands(list)
    setCi(0)
    if (list.length === 1) choose(list[0], list[0].tels[0] ?? '', list[0].emails[0] ?? '')
    else setChosen(false)
  }

  async function fromDevice() {
    try {
      offer(await pickFromDevice())
    } catch {
      // the user closed the picker
    }
  }

  async function fromFile(f: File | undefined) {
    if (!f) return
    offer(parseVcard(await f.text()))
    if (fileRef.current) fileRef.current.value = ''
  }

  const cur = cands[ci]
  const selDoctor = docList.find((d) => d.id === doctorId)

  // same number already saved somewhere?
  const duplicate = useMemo(() => {
    const p = digits(phone)
    if (p.length < 7) return ''
    const d = docList.find((x) => digits(x.phone) === p)
    if (d) return `המספר כבר שמור אצל ${d.title} ${d.name}`
    const c = (contacts.data ?? []).find((x) => digits(x.phone) === p)
    return c ? `המספר כבר שמור באיש הקשר "${c.name}"` : ''
  }, [phone, docList, contacts.data])

  async function save() {
    setError('')
    try {
      if (dest === 'doctor_update') {
        if (!doctorId) return setError('בחר רופא')
        await patchDoctor.mutateAsync({
          id: doctorId,
          phone: setPhoneOn && phone ? phone : undefined,
          email: setEmailOn && email ? email : undefined,
        })
        setDone(`הפרטים עודכנו אצל ${selDoctor?.title ?? ''} ${selDoctor?.name ?? ''}`)
      } else if (dest === 'doctor_contact') {
        if (!doctorId) return setError('בחר רופא')
        await upsertContact.mutateAsync({ name: name.trim() || 'ללא שם', role, phone, email, doctor_id: doctorId })
        setDone(`נוסף איש קשר לרופא ${selDoctor?.name ?? ''}`)
      } else if (dest === 'hospital_contact') {
        if (!hospitalId) return setError('בחר בית חולים')
        await upsertContact.mutateAsync({ name: name.trim() || 'ללא שם', role, phone, email, hospital_id: hospitalId })
        setDone(`נוסף איש קשר לבית החולים ${hospList.find((h) => h.id === hospitalId)?.name ?? ''}`)
      } else if (dest === 'new_doctor') {
        const n = stripTitle(name).trim()
        if (!n) return setError('הזן שם לרופא')
        await createDoctor.mutateAsync({
          name: n,
          title: /פרופ/.test(name) ? 'פרופסור' : 'דוקטור',
          position: '',
          phone,
          email,
          notes: 'נוצר מייבוא איש קשר מהטלפון',
          status,
          tracking_notes: '',
          pipeline_stage: '',
          next_step: '',
          next_step_date: null,
      contact_cadence_days: null,
          companyIds: [],
          procedureIds: [],
          roboticSystemIds: [],
          hospitals: hospitalId ? [{ hospital_id: hospitalId, role_at_hospital: '', sector: 'public', clinic_days: [], clinic_hours: '', clinic_note: '' }] : [],
        })
        setDone(`נוצר רופא חדש: ${n}`)
      } else {
        await upsertContact.mutateAsync({ name: name.trim() || 'ללא שם', role, phone, email })
        setDone('נוסף איש קשר כללי')
      }
      setChosen(false)
      setCands([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'השמירה נכשלה')
    }
  }

  const option = (id: Destination, children?: ReactNode) => (
    <div
      className={classNames(
        'rounded-xl border p-3 transition',
        dest === id ? 'border-brand-500 bg-brand-50/50' : 'border-slate-200 hover:bg-slate-50',
      )}
    >
      <label className="flex min-h-[32px] cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-slate-800">
        <input type="radio" name="dest" className="h-5 w-5 shrink-0" checked={dest === id} onChange={() => setDest(id)} />
        {DEST_LABEL[id]}
        {recommended === id && (
          <span className="chip !py-0 border-emerald-200 bg-emerald-50 text-emerald-700">
            <Sparkles size={12} /> מומלץ
          </span>
        )}
      </label>
      {dest === id && children && <div className="mt-3 space-y-3">{children}</div>}
    </div>
  )

  const doctorSelect = (
    <select className="input" aria-label="רופא" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
      <option value="">בחר רופא…</option>
      {docList.map((d) => (
        <option key={d.id} value={d.id}>{d.title} {d.name}</option>
      ))}
    </select>
  )
  const hospitalSelect = (
    <select className="input" aria-label="בית חולים" value={hospitalId} onChange={(e) => setHospitalId(e.target.value)}>
      <option value="">בחר בית חולים…</option>
      {hospList.map((h) => (
        <option key={h.id} value={h.id}>{h.name}</option>
      ))}
    </select>
  )
  const roleInput = (
    <label className="block">
      <span className="label">תפקיד</span>
      <input className="input" list="smart-roles" placeholder="בחר מהרשימה או כתוב תפקיד חופשי" value={role} onChange={(e) => setRole(e.target.value)} />
      <datalist id="smart-roles">
        {CONTACT_ROLES.map((r) => <option key={r} value={r} />)}
      </datalist>
    </label>
  )

  return (
    <Modal open onClose={onClose} title="ייבוא איש קשר מהטלפון" size="lg">
      <div className="space-y-4">
        {done && (
          <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {done}.{' '}
            {dest === 'doctor_update' && doctorId && (
              <Link to={`/doctors/${doctorId}`} className="font-medium underline">לכרטיס הרופא</Link>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {canPickContacts() && (
            <button type="button" className="btn-secondary max-sm:flex-1" onClick={fromDevice}>
              <BookUser size={16} />
              בחר מאנשי הקשר בטלפון
            </button>
          )}
          <button type="button" className="btn-secondary max-sm:flex-1" onClick={() => fileRef.current?.click()}>
            <FileUp size={16} />
            ייבוא מקובץ vCard
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".vcf,text/vcard,text/x-vcard,text/directory"
            className="hidden"
            onChange={(e) => fromFile(e.target.files?.[0])}
          />
        </div>
        {!canPickContacts() && (
          <p className="text-xs text-slate-500">
            באייפון / Outlook: שמור את איש הקשר כקובץ vCard (.vcf) — "שתף ← שמור בקבצים" — ובחר אותו כאן.
          </p>
        )}
        {msg && <p role="status" className="text-xs text-amber-700">{msg}</p>}

        {cands.length > 1 && !chosen && cur && (
          <div className="space-y-2 rounded-xl bg-slate-50 p-3">
            <label className="block">
              <span className="label">איזה איש קשר?</span>
              <select className="input" value={ci} onChange={(e) => setCi(Number(e.target.value))}>
                {cands.map((c, i) => (
                  <option key={i} value={i}>{c.name || c.tels[0] || c.emails[0] || '—'}</option>
                ))}
              </select>
            </label>
            <button
              className="btn-primary max-sm:w-full"
              onClick={() => choose(cur, cur.tels[0] ?? '', cur.emails[0] ?? '')}
            >
              המשך
            </button>
          </div>
        )}

        {done && !chosen && (
          <button type="button" className="btn-primary max-sm:w-full" onClick={onClose}>
            סיום
          </button>
        )}

        {chosen && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="label">שם</span>
                <input className="input" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="block">
                <span className="label">טלפון</span>
                {cur && cur.tels.length > 1 ? (
                  <select dir="ltr" className="input text-right" value={phone} onChange={(e) => setPhone(e.target.value)}>
                    {cur.tels.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                ) : (
                  <input dir="ltr" type="tel" inputMode="tel" autoComplete="off" className="input text-right" value={phone} onChange={(e) => setPhone(e.target.value)} />
                )}
              </label>
              <label className="block">
                <span className="label">אימייל</span>
                {cur && cur.emails.length > 1 ? (
                  <select dir="ltr" className="input text-right" value={email} onChange={(e) => setEmail(e.target.value)}>
                    {cur.emails.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input dir="ltr" type="email" inputMode="email" autoCapitalize="none" autoComplete="off" className="input text-right" value={email} onChange={(e) => setEmail(e.target.value)} />
                )}
              </label>
            </div>
            {duplicate && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{duplicate}</p>}

            <div>
              <p className="mb-1 text-sm font-semibold text-slate-700">לאן להוסיף?</p>
              {reasons.length > 0 && (
                <p className="mb-2 text-xs text-slate-500">למה זה מומלץ: {reasons.join(' · ')}</p>
              )}
              <div className="space-y-2">
                {option('doctor_update', <>
                  {doctorSelect}
                  {selDoctor && (
                    <div className="space-y-1 text-sm text-slate-600">
                      <label className="flex min-h-[32px] items-center gap-2">
                        <input type="checkbox" className="h-5 w-5 shrink-0" checked={setPhoneOn} disabled={!phone} onChange={(e) => setSetPhoneOn(e.target.checked)} />
                        עדכן טלפון{selDoctor.phone ? ` (כעת: ${selDoctor.phone})` : ' (כעת ריק)'}
                      </label>
                      <label className="flex min-h-[32px] items-center gap-2">
                        <input type="checkbox" className="h-5 w-5 shrink-0" checked={setEmailOn} disabled={!email} onChange={(e) => setSetEmailOn(e.target.checked)} />
                        עדכן אימייל{selDoctor.email ? ` (כעת: ${selDoctor.email})` : ' (כעת ריק)'}
                      </label>
                    </div>
                  )}
                </>)}
                {option('doctor_contact', <>
                  {doctorSelect}
                  {roleInput}
                </>)}
                {option('hospital_contact', <>
                  {hospitalSelect}
                  {roleInput}
                </>)}
                {option('new_doctor', <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="label">סטטוס</span>
                      <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                        {Object.entries(DOCTOR_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="label">בית חולים (אופציונלי)</span>
                      {hospitalSelect}
                    </label>
                  </div>
                </>)}
                {option('free_contact')}
              </div>
            </div>

            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button className="btn-secondary" onClick={onClose}>סגירה</button>
              <button
                className="btn-primary max-sm:flex-1"
                onClick={save}
                disabled={patchDoctor.isPending || upsertContact.isPending || createDoctor.isPending}
              >
                שמירה
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
