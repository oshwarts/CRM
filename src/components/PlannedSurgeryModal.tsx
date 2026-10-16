import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { ConfirmButton, Field, Modal } from './ui'
import { QuickDates } from './QuickDates'
import { SearchSelect } from './SearchSelect'
import { useAgents, useCompanies, useDoctors, useHospitals, useProcedures } from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import { useCanDelete } from '../lib/permissions'
import { useDeletePlannedSurgery, useSavePlannedSurgery, type PlannedSurgery } from '../lib/plannedSurgeries'
import { toast } from '../lib/toast'
import { classNames, todayISO } from '../lib/utils'

type Form = {
  surgery_date: string
  surgery_time: string
  doctor_id: string | null
  hospital_id: string | null
  procedure: string
  company: string
  notes: string
  cases: number
  agent_id: string
}

/**
 * Quick entry of a planned surgery that is not a MAKO surgery (no CT scan, no patient file): date, surgeon, hospital,
 * type. "Save and add another" keeps the date, surgeon and hospital so that a whole operating list goes in quickly.
 */
export function PlannedSurgeryModal({ surgery, date, hospitalId, onClose }: { surgery?: PlannedSurgery; date?: string; hospitalId?: string; onClose: () => void }) {
  const { isAdmin, user } = useAuth()
  const canDelete = useCanDelete()
  const doctors = useDoctors()
  const hospitals = useHospitals()
  const procedures = useProcedures()
  const companies = useCompanies()
  const agents = useAgents()
  const save = useSavePlannedSurgery()
  const del = useDeletePlannedSurgery()

  const [f, setF] = useState<Form>({
    surgery_date: surgery?.surgery_date ?? date ?? todayISO(),
    surgery_time: surgery?.surgery_time?.slice(0, 5) ?? '',
    doctor_id: surgery?.doctor_id ?? null,
    hospital_id: surgery?.hospital_id ?? hospitalId ?? null,
    procedure: surgery?.procedure ?? '',
    company: surgery?.company ?? '',
    notes: surgery?.notes ?? '',
    cases: surgery?.cases ?? 1,
    agent_id: surgery?.agent_id ?? user?.id ?? '',
  })
  const [tried, setTried] = useState(false)
  const [error, setError] = useState('')
  const set = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }))

  const doctorOptions = useMemo(
    () =>
      (doctors.data ?? []).map((d) => ({
        id: d.id,
        label: `${d.title} ${d.name}`.trim(),
        hint: d.doctor_hospitals.map((h) => h.hospital?.name).filter(Boolean).join(' '),
      })),
    [doctors.data],
  )
  const hospitalOptions = useMemo(() => (hospitals.data ?? []).map((h) => ({ id: h.id, label: h.name, hint: h.city })), [hospitals.data])
  // the usual non-MAKO surgeries first
  const procedureChips = useMemo(() => [...(procedures.data ?? [])].sort((a, b) => Number(a.is_mako) - Number(b.is_mako)).slice(0, 14), [procedures.data])

  function pickDoctor(id: string | null) {
    const d = (doctors.data ?? []).find((x) => x.id === id)
    // the surgeon's hospital is filled in when there is just one and none was chosen yet
    const own = d?.doctor_hospitals.filter((h) => h.hospital) ?? []
    set({ doctor_id: id, ...(!f.hospital_id && own.length === 1 ? { hospital_id: own[0].hospital_id } : {}) })
  }

  async function submit(another: boolean) {
    setError('')
    if (!f.surgery_date) {
      setTried(true)
      return
    }
    if (!f.procedure.trim() && !f.doctor_id && !f.hospital_id) {
      setTried(true)
      setError('מלא לפחות סוג ניתוח, רופא או בית חולים')
      return
    }
    try {
      await save.mutateAsync({
        id: surgery?.id,
        surgery_date: f.surgery_date,
        surgery_time: f.surgery_time || null,
        doctor_id: f.doctor_id,
        hospital_id: f.hospital_id,
        procedure: f.procedure,
        company: f.company,
        notes: f.notes,
        cases: f.cases,
        ...(isAdmin && f.agent_id ? { agent_id: f.agent_id } : {}),
      })
      if (another) {
        toast('הניתוח נוסף — אפשר להמשיך')
        set({ surgery_time: '', procedure: '', company: '', notes: '', cases: 1 })
        setTried(false)
      } else onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'השמירה נכשלה')
    }
  }

  const dateMissing = tried && !f.surgery_date

  return (
    <Modal open onClose={onClose} title={surgery ? 'עריכת ניתוח' : 'ניתוח מתוכנן'} size="lg">
      <div className="space-y-4">
        <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800">רישום מהיר של ניתוח או כמה ניתוחים מאותו סוג ביום אחד — בלי סריקה ובלי פרטי מטופל. מופיע בלוז השבועי.</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="תאריך הניתוח" error={dateMissing ? 'בחר תאריך' : undefined}>
            <input type="date" className="input" value={f.surgery_date} onChange={(e) => set({ surgery_date: e.target.value })} />
            <QuickDates value={f.surgery_date} onPick={(d) => set({ surgery_date: d ?? '' })} clearable={false} />
          </Field>
          <Field label="שעה (לא חובה)">
            <input type="time" className="input" dir="ltr" value={f.surgery_time} onChange={(e) => set({ surgery_time: e.target.value })} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="המנתח">
            <SearchSelect options={doctorOptions} value={f.doctor_id} onChange={pickDoctor} placeholder="חפש רופא…" clearLabel="ללא רופא" />
          </Field>
          <Field label="בית חולים">
            <SearchSelect options={hospitalOptions} value={f.hospital_id} onChange={(id) => set({ hospital_id: id })} placeholder="חפש בית חולים…" clearLabel="ללא בית חולים" />
          </Field>
        </div>

        <Field label="סוג הניתוח">
          <input className="input" dir="auto" placeholder="בחר מהרשימה או כתוב סוג ניתוח" value={f.procedure} onChange={(e) => set({ procedure: e.target.value })} />
          {procedureChips.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {procedureChips.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => set({ procedure: p.name })}
                  className={classNames(
                    'rounded-full border px-2.5 py-0.5 text-xs font-medium transition',
                    f.procedure === p.name ? 'border-brand-500 bg-brand-500 text-white' : 'border-brand-200 bg-white text-brand-700 hover:bg-brand-50',
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </Field>

        <Field label="כמה ניתוחים מהסוג הזה?">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-secondary !px-3" aria-label="פחות" disabled={f.cases <= 1} onClick={() => set({ cases: f.cases - 1 })}>
              −
            </button>
            <input
              type="number"
              min={1}
              max={99}
              inputMode="numeric"
              className="input !w-20 text-center"
              value={f.cases}
              onChange={(e) => set({ cases: Math.min(99, Math.max(1, Math.floor(Number(e.target.value)) || 1)) })}
            />
            <button type="button" className="btn-secondary !px-3" aria-label="יותר" disabled={f.cases >= 99} onClick={() => set({ cases: f.cases + 1 })}>
              +
            </button>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => set({ cases: n })}
                className={classNames('h-8 w-8 rounded-full border text-sm font-medium transition', f.cases === n ? 'border-brand-500 bg-brand-500 text-white' : 'border-brand-200 bg-white text-brand-700 hover:bg-brand-50')}
              >
                {n}
              </button>
            ))}
          </div>
        </Field>

        <Field label="חברה / מערכת (לא חובה)">
          <input className="input" dir="auto" placeholder="למשל: Zimmer, Stryker…" value={f.company} onChange={(e) => set({ company: e.target.value })} />
          {(companies.data ?? []).length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(companies.data ?? []).slice(0, 10).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => set({ company: c.name })}
                  className={classNames(
                    'rounded-full border px-2.5 py-0.5 text-xs font-medium transition',
                    f.company === c.name ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </Field>

        <Field label="הערות (לא חובה)">
          <input className="input" dir="auto" value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>

        {isAdmin && (
          <Field label="הסוכן שמלווה">
            <select className="input" value={f.agent_id} onChange={(e) => set({ agent_id: e.target.value })}>
              {(agents.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name || a.email}
                </option>
              ))}
            </select>
          </Field>
        )}

        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
          {surgery && canDelete(surgery.created_by) && (
            <ConfirmButton className="btn-ghost text-red-500" message="למחוק את הניתוח מהלוז?" onConfirm={() => del.mutate(surgery.id, { onSuccess: onClose })}>
              <Trash2 size={16} /> מחיקה
            </ConfirmButton>
          )}
          <span className="flex-1" />
          <button type="button" className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
          {!surgery && (
            <button type="button" className="btn-secondary" disabled={save.isPending} onClick={() => void submit(true)}>
              שמור והוסף עוד
            </button>
          )}
          <button type="button" className="btn-primary" disabled={save.isPending} onClick={() => void submit(false)}>
            שמירה
          </button>
        </div>
      </div>
    </Modal>
  )
}
