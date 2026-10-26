import { useEffect, useState } from 'react'
import { Building2, ExternalLink, Mail, MessageCircle, Pencil, Phone, UserRound } from 'lucide-react'
import { useAppSetting, useContacts, useHospitals } from '../lib/api'
import { useSetHospitalCommercial } from '../lib/hospitalStats'
import { AMI_SECRETARY_KEY, isPrivate, looksLikeEmail, parseSecretary, scanRoute, telHref, whatsappHref, type ScanRoute } from '../lib/scanCoordination'
import { SECTOR_LABELS } from '../lib/types'
import { classNames } from '../lib/utils'
import { Field } from './ui'

const pill = 'inline-flex min-h-[40px] items-center gap-1 rounded-full border px-3 text-sm font-medium'

function useRoute(hospitalId: string | undefined) {
  const hospitals = useHospitals()
  const contacts = useContacts()
  const ami = useAppSetting(AMI_SECRETARY_KEY)
  const hospital = hospitalId ? hospitals.data?.find((h) => h.id === hospitalId) : undefined
  return { hospital, contacts: contacts.data ?? [], route: hospital ? scanRoute(hospital, contacts.data ?? [], parseSecretary(ami.data)) : null }
}

/** a person to approach: the name and one-tap call / e-mail */
function Person({ name, role, phone, email }: { name: string; role?: string; phone: string; email: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-slate-800">
        <UserRound size={15} className="shrink-0 text-slate-400" aria-hidden />
        <span className="[overflow-wrap:anywhere]">
          {name}
          {role ? <span className="font-normal text-slate-500"> · {role}</span> : null}
        </span>
      </span>
      {phone && (
        <a href={telHref(phone)} className={classNames(pill, 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100')} aria-label={`התקשר ל${name || 'איש הקשר'}`}>
          <Phone size={14} aria-hidden /> <span dir="ltr">{phone}</span>
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} className={classNames(pill, 'border-brand-200 bg-white text-brand-700 hover:bg-brand-50')}>
          <Mail size={14} aria-hidden /> <span dir="ltr" className="max-w-[13rem] truncate">{email}</span>
        </a>
      )}
    </div>
  )
}

function RouteView({ r }: { r: ScanRoute }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">{r.instruction}</p>
      {r.first && <Person {...r.first} />}
      {r.mode === 'private' && (
        <div className="space-y-1.5 rounded-xl bg-slate-50 p-2.5">
          <p className="text-xs font-semibold text-slate-500">מזכירת אמי מתאמת מול בית החולים:</p>
          {r.imaging.center && (
            <p className="flex items-center gap-1.5 text-sm text-slate-700">
              <Building2 size={15} className="shrink-0 text-slate-400" aria-hidden /> <span className="[overflow-wrap:anywhere]">{r.imaging.center}</span>
            </p>
          )}
          {r.imaging.contact && <Person name={r.imaging.contact.name || 'איש קשר'} role={r.imaging.contact.role} phone={r.imaging.contact.phone} email="" />}
          {r.imaging.email && (
            <a href={`mailto:${r.imaging.email}`} className={classNames(pill, 'border-brand-200 bg-white text-brand-700 hover:bg-brand-50')}>
              <Mail size={14} aria-hidden /> <span dir="ltr" className="max-w-[14rem] truncate">{r.imaging.email}</span>
            </a>
          )}
          {(r.imaging.whatsappName || r.imaging.whatsappUrl) &&
            (r.imaging.whatsappUrl ? (
              <a href={r.imaging.whatsappUrl} target="_blank" rel="noreferrer" className={classNames(pill, 'border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50')}>
                <MessageCircle size={14} aria-hidden /> {r.imaging.whatsappName || 'קבוצת וואטסאפ'} <ExternalLink size={12} aria-hidden />
              </a>
            ) : (
              <p className="flex items-center gap-1.5 text-sm text-slate-700">
                <MessageCircle size={15} className="shrink-0 text-slate-400" aria-hidden /> קבוצת וואטסאפ: {r.imaging.whatsappName}
              </p>
            ))}
        </div>
      )}
      {r.hours && <p className="text-sm text-slate-600">שעות זמינות: <span dir="auto" className="font-medium">{r.hours}</span></p>}
      {r.notes && <p className="whitespace-pre-line text-sm text-slate-600 [overflow-wrap:anywhere]">{r.notes}</p>}
    </div>
  )
}

type Draft = { contact: string; phone: string; email: string; hours: string; notes: string; center: string; waName: string; waUrl: string }

/**
 * "Who do I approach to coordinate the CT?" for a hospital, with the way to edit it. Public hospital: its secretary. Private hospital:
 * the AMI secretary, who works with the imaging center (contact, e-mail, WhatsApp group). Saved on the hospital, so it shows on every scan of it.
 */
export function ScanCoordination({ hospitalId }: { hospitalId: string }) {
  const { hospital, contacts, route } = useRoute(hospitalId)
  const save = useSetHospitalCommercial()
  const [editing, setEditing] = useState(false)
  const [d, setD] = useState<Draft | null>(null)
  const [error, setError] = useState('')

  // a different hospital chosen in the form: start from a clean view
  useEffect(() => {
    setEditing(false)
    setError('')
  }, [hospitalId])

  if (!hospitalId || !hospital || !route) return null
  const priv = isPrivate(hospital)

  const open = () => {
    setD({
      contact: hospital.scan_contact_id ?? '',
      phone: hospital.scan_phone ?? '',
      email: hospital.scan_email ?? '',
      hours: hospital.scan_hours ?? '',
      notes: hospital.scan_notes ?? '',
      center: hospital.scan_center_name ?? '',
      waName: hospital.scan_whatsapp_name ?? '',
      waUrl: hospital.scan_whatsapp_url ?? '',
    })
    setError('')
    setEditing(true)
  }
  const set = (p: Partial<Draft>) => setD((x) => (x ? { ...x, ...p } : x))

  function submit() {
    if (!d) return
    if (d.email.trim() && !looksLikeEmail(d.email)) return setError('כתובת המייל אינה תקינה')
    if (d.waUrl.trim() && !whatsappHref(d.waUrl)) return setError('הקישור לקבוצה צריך להתחיל ב-https://chat.whatsapp.com/ (או https://wa.me/)')
    setError('')
    save.mutate(
      {
        id: hospitalId,
        scan_contact_id: d.contact || null,
        scan_phone: d.phone.trim(),
        scan_email: d.email.trim(),
        scan_hours: d.hours.trim(),
        scan_notes: d.notes.trim(),
        scan_center_name: d.center.trim(),
        scan_whatsapp_name: d.waName.trim(),
        scan_whatsapp_url: d.waUrl.trim(),
      },
      { onSuccess: () => setEditing(false), onError: () => setError('השמירה נכשלה, נסה שוב') },
    )
  }

  // the hospital's own contacts first, then everybody else
  const list = [...contacts].sort((a, b) => Number(b.hospital_id === hospitalId) - Number(a.hospital_id === hospitalId) || a.name.localeCompare(b.name, 'he'))
  // inside the scan form an Enter in a field must save this block, not the whole form
  const enter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
      e.preventDefault()
      submit()
    }
  }

  return (
    <section className="col-span-2 space-y-2 rounded-2xl border border-brand-100 bg-brand-50/40 p-3 sm:col-span-3" aria-label="תיאום תור לסריקה">
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-brand-800">
          תיאום תור לסריקה
          <span className={classNames('chip', priv ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-slate-200 bg-white text-slate-600')}>{SECTOR_LABELS[hospital.sector] ?? 'ציבורי'}</span>
        </h4>
        {!editing && (
          <button type="button" className="btn-ghost !px-2 text-brand-700" onClick={open} aria-label="עריכת פרטי התיאום">
            <Pencil size={16} aria-hidden />
            <span className="text-sm">{route.empty ? 'הוסף' : 'עריכה'}</span>
          </button>
        )}
      </div>

      {!editing && (route.empty && !priv ? <p className="text-sm text-slate-500">עוד לא הוגדר מי מתאם סריקות בבית החולים. לחץ "הוסף" כדי לבחור את המזכירה.</p> : <RouteView r={route} />)}

      {editing && d && (
        <div className="space-y-3" onKeyDown={enter}>
          <p className="text-xs text-slate-500">
            {priv ? 'בית חולים פרטי: הסוכן מעביר למזכירת אמי (מוגדרת פעם אחת בהגדרות). כאן — עם מי היא מתאמת בבית החולים.' : 'בית חולים ציבורי: הסוכן מתאם ישירות מול המזכירה.'}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={priv ? 'איש קשר במכון / בבית החולים' : 'מזכירה — איש קשר מהמערכת'} className="sm:col-span-2">
              <select className="input" value={d.contact} onChange={(e) => set({ contact: e.target.value })}>
                <option value="">—</option>
                {list.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.role ? ` · ${c.role}` : ''}
                    {c.hospital_id === hospitalId ? '' : c.hospital_id ? ' (בית חולים אחר)' : ''}
                  </option>
                ))}
              </select>
            </Field>
            {priv && (
              <Field label="שם מכון הדימות" className="sm:col-span-2">
                <input className="input" dir="auto" autoComplete="off" value={d.center} onChange={(e) => set({ center: e.target.value })} />
              </Field>
            )}
            <Field label="טלפון לתיאום (אם שונה)">
              <input className="input" type="tel" inputMode="tel" dir="ltr" autoComplete="off" value={d.phone} onChange={(e) => set({ phone: e.target.value })} />
            </Field>
            <Field label="מייל לתיאום">
              <input className="input" type="email" inputMode="email" dir="ltr" autoComplete="off" value={d.email} onChange={(e) => set({ email: e.target.value })} />
            </Field>
            {priv && (
              <>
                <Field label="שם קבוצת הוואטסאפ">
                  <input className="input" dir="auto" autoComplete="off" value={d.waName} onChange={(e) => set({ waName: e.target.value })} />
                </Field>
                <Field label="קישור הזמנה לקבוצה">
                  <input className="input" type="url" inputMode="url" dir="ltr" autoComplete="off" placeholder="https://chat.whatsapp.com/…" value={d.waUrl} onChange={(e) => set({ waUrl: e.target.value })} />
                </Field>
              </>
            )}
            <Field label="שעות זמינות" className="sm:col-span-2">
              <input className="input" dir="auto" autoComplete="off" placeholder="למשל: א׳–ה׳ עד 15:00" value={d.hours} onChange={(e) => set({ hours: e.target.value })} />
            </Field>
            <Field label="הערות לתיאום" className="sm:col-span-2">
              <textarea className="input min-h-[72px]" dir="auto" value={d.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="איך מתאמים, מה לשלוח, כמה זמן מראש" />
            </Field>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>
              ביטול
            </button>
            <button type="button" className="btn-primary" disabled={save.isPending} onClick={submit}>
              שמירה
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

/** one short line for the scan lists: who to approach for this hospital */
export function ScanContactLine({ hospitalId, className }: { hospitalId: string | undefined; className?: string }) {
  const { route } = useRoute(hospitalId)
  const f = route?.first
  if (!route || !f) return null
  return (
    <div className={className} title="למי לפנות לתיאום הסריקה">
      {route.mode === 'private' ? 'תיאום דרך אמי' : 'תיאום'}: {f.name}
      {f.phone && (
        <>
          {' · '}
          <a href={telHref(f.phone)} dir="ltr" className="underline" onClick={(e) => e.stopPropagation()}>
            {f.phone}
          </a>
        </>
      )}
    </div>
  )
}
