import { useEffect, useState } from 'react'
import { Flag } from 'lucide-react'
import type { MapHospital } from '../lib/api'
import { STATUS_CHIP, STATUS_LABELS, STATUS_ORDER, suggestStatus, useSetHospitalCommercial, type CommercialStatus } from '../lib/hospitalStats'
import { QuickDates } from './QuickDates'
import { classNames } from '../lib/utils'

/** the commercial standing of the hospital and the next step with it (everybody can edit) */
export function HospitalCommercial({ hospital: h }: { hospital: MapHospital }) {
  const set = useSetHospitalCommercial()
  const robots = h.hospital_robotic_systems.map((r) => r.system?.name).filter((x): x is string => !!x)
  const stored = (h.commercial_status ?? '') as CommercialStatus | ''
  const status = stored || suggestStatus(robots)
  const [step, setStep] = useState(h.next_step ?? '')
  const [date, setDate] = useState(h.next_step_date ?? '')
  useEffect(() => {
    setStep(h.next_step ?? '')
    setDate(h.next_step_date ?? '')
  }, [h.id, h.next_step, h.next_step_date])
  const dirty = step !== (h.next_step ?? '') || date !== (h.next_step_date ?? '')

  return (
    <section className="card space-y-3 p-3.5 sm:p-4">
      <h2 className="flex items-center gap-2 text-base font-semibold text-brand-800">
        <Flag size={16} /> מצב מסחרי והצעד הבא
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            disabled={set.isPending}
            onClick={() => set.mutate({ id: h.id, commercial_status: s })}
            className={classNames('rounded-full border px-3 py-1 text-sm font-medium transition', status === s ? STATUS_CHIP[s] + ' ring-2 ring-offset-1 ring-current' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50')}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
        {!stored && <span className="w-full text-xs text-slate-500">מוצע לפי הרובוטים — לחץ כדי לשמור</span>}
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:gap-x-3">
        <label className="block">
          <span className="label">הצעד הבא</span>
          <input className="input" dir="auto" placeholder="למשל: הצגה להנהלה, הצעת מחיר, פגישה עם מנהל חדר הניתוח" value={step} onChange={(e) => setStep(e.target.value)} />
        </label>
        <div>
          <label className="block w-44 max-w-full">
            <span className="label">עד תאריך</span>
            <input type="date" className="input !px-2.5" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <QuickDates value={date || null} onPick={(d) => setDate(d ?? '')} />
        </div>
      </div>
      {dirty && (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setStep(h.next_step ?? '')
              setDate(h.next_step_date ?? '')
            }}
          >
            ביטול
          </button>
          <button type="button" className="btn-primary" disabled={set.isPending} onClick={() => set.mutate({ id: h.id, next_step: step.trim(), next_step_date: date || null })}>
            שמירה
          </button>
        </div>
      )}
    </section>
  )
}
