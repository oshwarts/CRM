import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronDown, Flag, Pencil } from 'lucide-react'
import type { MapHospital } from '../lib/api'
import { STATUS_CHIP, STATUS_LABELS, STATUS_ORDER, suggestStatus, useSetHospitalCommercial, type CommercialStatus } from '../lib/hospitalStats'
import { QuickDates } from './QuickDates'
import { classNames, formatDate, todayISO } from '../lib/utils'

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
  const [error, setError] = useState('')
  // the card is a one-line summary; the status chips and the next-step form open on demand (the phone needs the screen for the content)
  const [open, setOpen] = useState(false)
  const lastSent = useRef(0)
  const dirty = step !== (h.next_step ?? '') || date !== (h.next_step_date ?? '')
  const overdue = !!h.next_step_date && h.next_step_date < todayISO() && !!h.next_step
  const reset = () => {
    setStep(h.next_step ?? '')
    setDate(h.next_step_date ?? '')
    setError('')
  }
  function save() {
    if (set.isPending || Date.now() - lastSent.current < 600) return
    if (date && !step.trim()) return setError('כתוב את הצעד הבא, או נקה את התאריך')
    setError('')
    lastSent.current = Date.now()
    set.mutate({ id: h.id, next_step: step.trim(), next_step_date: date || null })
  }

  const expanded = open || dirty
  return (
    <section className="card p-3 sm:p-4">
      <button
        type="button"
        className="flex min-h-[44px] w-full items-center gap-2 text-right"
        aria-expanded={expanded}
        aria-controls="hospital-commercial-body"
        onClick={() => setOpen((v) => !v)}
      >
        <Flag size={16} className="shrink-0 text-brand-700" aria-hidden />
        <span className={classNames('chip shrink-0', STATUS_CHIP[status])}>{STATUS_LABELS[status]}</span>
        <span className="min-w-0 flex-1 text-sm">
          {h.next_step ? (
            <>
              <span dir="auto" className="block truncate font-medium text-slate-700">{h.next_step}</span>
              {h.next_step_date && (
                <span className={classNames('inline-flex items-center gap-1 text-xs', overdue ? 'font-medium text-amber-700' : 'text-slate-500')}>
                  <CalendarDays size={11} aria-hidden /> {formatDate(h.next_step_date)}
                  {overdue ? ' · עבר' : ''}
                </span>
              )}
            </>
          ) : (
            <span className="text-slate-500">לא הוגדר צעד הבא — לחץ להוספה</span>
          )}
        </span>
        {expanded ? <ChevronDown size={18} className="shrink-0 text-slate-400" aria-hidden /> : <Pencil size={16} className="shrink-0 text-slate-400" aria-hidden />}
        <span className="sr-only">{expanded ? 'סגור את עריכת המצב המסחרי' : 'ערוך מצב מסחרי וצעד הבא'}</span>
      </button>
      <div id="hospital-commercial-body" hidden={!expanded} className="mt-3 space-y-3 border-t border-slate-100 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            disabled={set.isPending}
            onClick={() => set.mutate({ id: h.id, commercial_status: s })}
            className={classNames('max-sm:!min-h-[40px] rounded-full border px-3 py-1 text-sm font-medium transition', status === s ? STATUS_CHIP[s] + ' ring-2 ring-offset-1 ring-current' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50')}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
        {!stored && <span className="w-full text-xs text-slate-500">מוצע לפי הרובוטים — לחץ כדי לשמור</span>}
      </div>
      <form
        noValidate
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (dirty) save()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && dirty) reset()
        }}
      >
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:gap-x-3">
        <label className="block">
          <span className="label">הצעד הבא</span>
          <input className="input" dir="auto" autoComplete="off" enterKeyHint="done" placeholder="למשל: הצגה להנהלה, הצעת מחיר, פגישה עם מנהל חדר הניתוח" value={step} onChange={(e) => setStep(e.target.value)} />
        </label>
        <div>
          <label className="block w-44 max-w-full">
            <span className="label">עד תאריך</span>
            <input type="date" className="input !px-2.5" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <QuickDates value={date || null} onPick={(d) => setDate(d ?? '')} />
        </div>
      </div>
      {overdue && !dirty && <p className="text-xs font-medium text-amber-700">עבר התאריך שנקבע לצעד ({formatDate(h.next_step_date)}) — עדכן את הצעד או את התאריך</p>}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {dirty && (
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={reset}>
            ביטול
          </button>
          <button type="submit" className="btn-primary" disabled={set.isPending}>
            שמירה
          </button>
        </div>
      )}
      </form>
      </div>
    </section>
  )
}
