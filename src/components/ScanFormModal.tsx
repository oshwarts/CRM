import { useMemo, useRef, useState } from 'react'
import {
  useDoctors,
  useImplantFields,
  useImplantOptions,
  useMakoHospitals,
  useUpsertPatientScan,
} from '../lib/api'
import {
  HEALTH_FUNDS,
  SCAN_PROCEDURE_LABELS,
  SCAN_STATUS_LABELS,
  type PatientScanRow,
} from '../lib/types'
import { Field, Modal } from './ui'
import { implantFieldsOf, optionsForField } from '../lib/implants'
import { ImportContactButton } from './ImportContactButton'
import { ScanCoordination } from './ScanCoordination'
export type ScanDraft = {
  hospital_id: string
  surgery_date: string
  patient_name: string
  patient_phone: string
  patient_id_number: string
  patient_dob: string
  health_fund: string
  insurance: string
  surgeon_id: string
  procedure_type: 'knee' | 'uni' | 'hip'
  side: string
  ct_date: string
  ct_time: string
  anaesthesia_note: string
  scanned: boolean
  disk_collected: boolean
  plan_ready: boolean
  rescan: boolean
  rescan_date: string
  rescan_reason: string
  rescan_done: boolean
  uploaded: boolean
  status: string
  implant_data: Record<string, string>
  notes: string
}

type Draft = ScanDraft

function toDraft(s?: PatientScanRow): Draft {
  return {
    hospital_id: s?.hospital_id ?? '',
    surgery_date: s?.surgery_date ?? '',
    patient_name: s?.patient_name ?? '',
    patient_phone: s?.patient_phone ?? '',
    patient_id_number: s?.patient_id_number ?? '',
    patient_dob: s?.patient_dob ?? '',
    health_fund: s?.health_fund ?? '',
    insurance: s?.insurance ?? '',
    surgeon_id: s?.surgeon_id ?? '',
    procedure_type: (s?.procedure_type as Draft['procedure_type']) ?? 'knee',
    side: s?.side ?? '',
    ct_date: s?.ct_date ?? '',
    ct_time: s?.ct_time?.slice(0, 5) ?? '',
    anaesthesia_note: s?.anaesthesia_note ?? '',
    scanned: s?.scanned ?? false,
    disk_collected: s?.disk_collected ?? false,
    plan_ready: s?.plan_ready ?? false,
    rescan: s?.rescan ?? false,
    rescan_date: s?.rescan_date ?? '',
    rescan_reason: s?.rescan_reason ?? '',
    rescan_done: s?.rescan_done ?? false,
    uploaded: s?.uploaded ?? false,
    status: s?.status ?? 'planned',
    implant_data: (s?.implant_data as Record<string, string>) ?? {},
    notes: s?.notes ?? '',
  }
}

export function ScanFormModal({
  scan,
  initial,
  notices,
  onClose,
}: {
  scan?: PatientScanRow
  initial?: Partial<ScanDraft>
  notices?: string[]
  onClose: () => void
}) {
  const hospitals = useMakoHospitals()
  const doctors = useDoctors()
  const options = useImplantOptions()
  const fieldRows = useImplantFields()
  const save = useUpsertPatientScan()

  const [d, setD] = useState<Draft>(() => ({ ...toDraft(scan), ...initial }))
  const [error, setError] = useState<string | null>(null)
  const [fieldErr, setFieldErr] = useState<{ hospital?: string; name?: string; surgeon?: string }>({})
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }))

  const implantFields = useMemo(() => implantFieldsOf(d.procedure_type, fieldRows.data), [d.procedure_type, fieldRows.data])

  // what was on the form when it opened: closing with typed changes asks first (Escape / a tap outside must not lose a patient's details)
  const [opened] = useState(() => JSON.stringify(d))
  function close() {
    if (JSON.stringify(d) === opened || window.confirm('לסגור בלי לשמור? מה שהוקלד יימחק.')) onClose()
  }

  // a ref, not `save.isPending`: two taps in the same instant both see "not saving yet" until the screen redraws
  const sending = useRef(false)

  async function submit() {
    if (sending.current) return
    setError(null)
    const errs: typeof fieldErr = {}
    if (!d.hospital_id) errs.hospital = 'בחר בית חולים'
    if (!d.patient_name.trim()) errs.name = 'הזן שם מטופל'
    if (d.status === 'done' && !d.surgeon_id) errs.surgeon = 'ניתוח שבוצע — יש לשייך מנתח'
    setFieldErr(errs)
    if (Object.keys(errs).length > 0) {
      setError('יש להשלים את השדות המסומנים')
      // the first missing field gets the cursor (on a phone it may be far above the save button)
      setTimeout(() => document.querySelector<HTMLElement>('[role="dialog"] [aria-invalid="true"]')?.focus(), 60)
      return
    }
    sending.current = true
    try {
      await save.mutateAsync({
        id: scan?.id,
        hospital_id: d.hospital_id,
        surgery_date: d.surgery_date || null,
        patient_name: d.patient_name.trim(),
        patient_phone: d.patient_phone.trim(),
        patient_id_number: d.patient_id_number.trim(),
        patient_dob: d.patient_dob || null,
        health_fund: d.health_fund,
        insurance: d.insurance.trim(),
        surgeon_id: d.surgeon_id || null,
        procedure_type: d.procedure_type,
        side: d.side,
        ct_date: d.ct_date || null,
        ct_time: d.ct_time || null,
        anaesthesia_note: d.anaesthesia_note.trim(),
        scanned: d.scanned,
        disk_collected: d.disk_collected,
        plan_ready: d.plan_ready,
        rescan: d.rescan,
        rescan_date: d.rescan && d.rescan_date ? d.rescan_date : null,
        rescan_reason: d.rescan ? d.rescan_reason.trim() : '',
        rescan_done: d.rescan ? d.rescan_done : false,
        uploaded: d.disk_collected,
        status: d.status,
        implant_data: d.implant_data,
        notes: d.notes.trim(),
      })
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : ''
      setError(/אין חיבור/.test(msg) ? 'אין חיבור לרשת — המטופל לא נשמר. נסה שוב כשהחיבור חוזר.' : /status_check/.test(msg) ? 'הסטטוס "נדחה" עוד לא פעיל במסד הנתונים — בחר סטטוס אחר ופנה למנהל המערכת.' : msg ? `השמירה נכשלה: ${msg}` : 'השמירה נכשלה')
    } finally {
      sending.current = false
    }
  }

  const check = 'flex min-h-[40px] items-center gap-2 text-sm'

  return (
    <Modal open onClose={close} title={scan ? 'עריכת מטופל' : 'הוספת מטופל'} size="xl">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
      <div className="space-y-5">
        {notices && notices.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <p className="mb-1 font-semibold">הפרטים חולצו אוטומטית מההפנייה — בדוק לפני שמירה:</p>
            <ul className="list-inside list-disc space-y-0.5">
              {notices.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        )}

        <section className="space-y-3" aria-label="פרטי המטופל">
          <h3 className="text-sm font-semibold text-brand-800">פרטי המטופל</h3>
          <ImportContactButton
            onPick={(c) =>
              set({
                patient_name: d.patient_name || c.name,
                patient_phone: c.phone || d.patient_phone,
              })
            }
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="שם מלא" error={fieldErr.name} className="col-span-2 sm:col-span-1">
              <input className="input" autoComplete="off" value={d.patient_name} onChange={(e) => set({ patient_name: e.target.value })} />
            </Field>
            <Field label="טלפון" className="min-w-0">
              <input dir="ltr" type="tel" inputMode="tel" autoComplete="off" className="input text-right" value={d.patient_phone} onChange={(e) => set({ patient_phone: e.target.value })} />
            </Field>
            <Field label="ת״ז" className="min-w-0">
              <input dir="ltr" inputMode="numeric" autoComplete="off" className="input text-right" value={d.patient_id_number} onChange={(e) => set({ patient_id_number: e.target.value })} />
            </Field>
            <Field label="תאריך לידה" className="min-w-0">
              <input type="date" className="input" value={d.patient_dob} onChange={(e) => set({ patient_dob: e.target.value })} />
            </Field>
            <Field label="קופת חולים" className="min-w-0">
              <select className="input" value={d.health_fund} onChange={(e) => set({ health_fund: e.target.value })}>
                <option value="">—</option>
                {HEALTH_FUNDS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </Field>
            <Field label="חברת ביטוח" className="col-span-2 sm:col-span-1">
              <input className="input" autoComplete="off" value={d.insurance} onChange={(e) => set({ insurance: e.target.value })} />
            </Field>
          </div>
        </section>

        <section className="space-y-3" aria-label="ניתוח">
          <h3 className="text-sm font-semibold text-brand-800">הניתוח</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="בית חולים (MAKO)" error={fieldErr.hospital} className="col-span-2 sm:col-span-1">
              <select className="input" value={d.hospital_id} onChange={(e) => set({ hospital_id: e.target.value })}>
                <option value="">בחר…</option>
                {(hospitals.data ?? []).map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </Field>
            <Field label="תאריך ניתוח" className="min-w-0">
              <input type="date" className="input" value={d.surgery_date} onChange={(e) => set({ surgery_date: e.target.value })} />
            </Field>
            <Field label="סטטוס" className="min-w-0">
              <select className="input" value={d.status} onChange={(e) => set({ status: e.target.value })}>
                {Object.entries(SCAN_STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="מנתח" error={fieldErr.surgeon} className="col-span-2 sm:col-span-1">
              <select className="input" value={d.surgeon_id} onChange={(e) => set({ surgeon_id: e.target.value })}>
                <option value="">בחר רופא…</option>
                {(doctors.data ?? []).map((doc) => (
                  <option key={doc.id} value={doc.id}>{doc.title} {doc.name}</option>
                ))}
              </select>
            </Field>
            <Field label="סוג ניתוח" className="min-w-0">
              <select
                className="input"
                value={d.procedure_type}
                onChange={(e) => set({ procedure_type: e.target.value as Draft['procedure_type'], implant_data: {} })}
              >
                {Object.entries(SCAN_PROCEDURE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="רגל" className="min-w-0">
              <select className="input" value={d.side} onChange={(e) => set({ side: e.target.value })}>
                <option value="">—</option>
                <option value="ימין">ימין</option>
                <option value="שמאל">שמאל</option>
              </select>
            </Field>
          </div>
        </section>

        <section className="space-y-3" aria-label="סריקת CT">
          <h3 className="text-sm font-semibold text-brand-800">סריקת CT</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="תאריך CT" className="min-w-0">
              <input type="date" className="input" value={d.ct_date} onChange={(e) => set({ ct_date: e.target.value })} />
            </Field>
            <Field label="שעת CT" className="min-w-0">
              <input type="time" className="input" value={d.ct_time} onChange={(e) => set({ ct_time: e.target.value })} />
            </Field>
            <Field label="תאריך ושעה מרדים" className="col-span-2 sm:col-span-1">
              <input className="input" value={d.anaesthesia_note} onChange={(e) => set({ anaesthesia_note: e.target.value })} placeholder="לדוגמה: 12.8.26 שעה 10:20" />
            </Field>
            <ScanCoordination hospitalId={d.hospital_id} />
          </div>

          <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-3">
            <label className={check}>
              <input type="checkbox" className="h-5 w-5" checked={d.scanned} onChange={(e) => set({ scanned: e.target.checked })} />
              נסרק
            </label>
            <label className={check}>
              <input type="checkbox" className="h-5 w-5" checked={d.disk_collected} onChange={(e) => set({ disk_collected: e.target.checked })} />
              הועלה דיסק
            </label>
            <label className={check}>
              <input type="checkbox" className="h-5 w-5" checked={d.plan_ready} onChange={(e) => set({ plan_ready: e.target.checked })} />
              תוכנית מוכנה
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 p-3">
            <label className={`${check} font-medium`}>
              <input type="checkbox" className="h-5 w-5" checked={d.rescan} onChange={(e) => set({ rescan: e.target.checked })} />
              סריקה חוזרת
            </label>
            {d.rescan && (
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <Field label="תאריך סריקה חוזרת">
                  <input type="date" className="input" value={d.rescan_date} onChange={(e) => set({ rescan_date: e.target.value })} />
                </Field>
                <Field label="סיבה">
                  <input className="input" value={d.rescan_reason} onChange={(e) => set({ rescan_reason: e.target.value })} placeholder="לדוגמה: איכות סריקה לא תקינה" />
                </Field>
                <label className={`${check} sm:self-end`}>
                  <input type="checkbox" className="h-5 w-5" checked={d.rescan_done} onChange={(e) => set({ rescan_done: e.target.checked })} />
                  הסריקה החוזרת בוצעה
                </label>
              </div>
            )}
          </div>
        </section>

        <section aria-label="מידות שתל">
          <h3 className="mb-2 text-sm font-semibold text-brand-800">מידות שתל ({SCAN_PROCEDURE_LABELS[d.procedure_type]})</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {implantFields.map((f) => {
              // a field that depends on another (neck on head) offers the sizes that fit the chosen value
              const { values, narrowedBy } = optionsForField(f, d.implant_data, implantFields, options.data ?? [])
              return (
                <Field key={f.key} label={f.label} className="min-w-0">
                  <input
                    className="input"
                    list={`impl-${f.key}`}
                    autoComplete="off"
                    value={d.implant_data[f.key] ?? ''}
                    onChange={(e) =>
                      set({ implant_data: { ...d.implant_data, [f.key]: e.target.value } })
                    }
                  />
                  <datalist id={`impl-${f.key}`}>
                    {values.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                  {narrowedBy && <p className="mt-0.5 text-xs text-brand-600">מידות עבור {narrowedBy}</p>}
                </Field>
              )
            })}
          </div>
        </section>

        <Field label="הערות">
          <textarea className="input min-h-20" value={d.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
        <button type="button" className="btn-secondary" onClick={close}>ביטול</button>
        <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'שומר…' : 'שמירה'}</button>
      </div>
      </form>
    </Modal>
  )
}
