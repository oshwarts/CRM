import { useEffect, useState } from 'react'
import { Check, ChevronDown, Flag } from 'lucide-react'
import { useSetDoctorPipeline, useStageHistory, usePipelineStages } from '../lib/pipeline'
import { toast } from '../lib/toast'
import { classNames, daysUntil, formatDate, isOverdue } from '../lib/utils'
import { QuickDates } from './QuickDates'

/** a potential doctor's place in the funnel: the stage (tap a stage to move him), the next step, how long he has been in the stage, the history */
export function DoctorPipeline({ doctor }: { doctor: { id: string; pipeline_stage: string; next_step: string; next_step_date: string | null; status: string } }) {
  const { stages, names, won } = usePipelineStages()
  const history = useStageHistory(doctor.id)
  const set = useSetDoctorPipeline()
  const [step, setStep] = useState(doctor.next_step ?? '')
  const [date, setDate] = useState(doctor.next_step_date ?? '')
  const [showHistory, setShowHistory] = useState(false)
  useEffect(() => {
    setStep(doctor.next_step ?? '')
    setDate(doctor.next_step_date ?? '')
  }, [doctor.id, doctor.next_step, doctor.next_step_date])

  const current = doctor.pipeline_stage
  const idx = names.indexOf(current)
  const dirty = step !== (doctor.next_step ?? '') || date !== (doctor.next_step_date ?? '')
  // since when he is in this stage: the latest change that put him there
  const enteredOn = (history.data ?? []).find((h) => h.stage === current)?.changed_at.slice(0, 10) ?? null
  const daysIn = enteredOn ? -(daysUntil(enteredOn) ?? 0) : null
  const overdue = isOverdue(doctor.next_step_date)

  function move(stage: string) {
    if (stage === current) return
    const becomesClient = !!won && stage === won && doctor.status === 'potential' && window.confirm(`הרופא הגיע לשלב "${stage}". להפוך אותו ללקוח?`)
    const before = current
    set.mutate(
      { id: doctor.id, pipeline_stage: stage, ...(becomesClient ? { status: 'client' } : {}) },
      { onSuccess: () => toast(`השלב עודכן: ${stage}`, { action: { label: 'ביטול', run: () => set.mutate({ id: doctor.id, pipeline_stage: before, ...(becomesClient ? { status: 'potential' } : {}) }) } }) },
    )
  }

  return (
    <section className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-brand-800">
          <Flag size={16} /> משפך — באיזה שלב הרופא ומה הצעד הבא
        </h2>
        {current && (
          <span className={classNames('text-xs', daysIn != null && daysIn > 30 ? 'font-semibold text-amber-700' : 'text-slate-500')}>
            {daysIn != null ? `${daysIn === 0 ? 'נכנס לשלב היום' : `${daysIn} ימים בשלב`}` : ''}
          </span>
        )}
      </div>

      {/* the stages as steps: the ones he passed are filled, the one he is in is dark */}
      <ol className="flex flex-wrap gap-1.5" aria-label="שלבי המשפך">
        {names.map((n, i) => {
          const done = idx >= 0 && i < idx
          const now = i === idx
          return (
            <li key={n}>
              <button
                type="button"
                aria-current={now ? 'step' : undefined}
                disabled={set.isPending}
                onClick={() => move(n)}
                className={classNames(
                  'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium transition',
                  now ? 'border-[#00326d] bg-[#00326d] text-white' : done ? 'border-brand-300 bg-brand-100 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                )}
              >
                {done && <Check size={13} />}
                {n}
              </button>
            </li>
          )
        })}
      </ol>
      {!current && <p className="text-xs text-amber-700">עוד לא נקבע שלב — לחץ על השלב שבו הרופא נמצא.</p>}
      {current && idx < 0 && stages.length > 0 && <p className="text-xs text-amber-700">השלב "{current}" כבר לא ברשימה — בחר שלב אחר.</p>}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="label">הצעד הבא</span>
          <input className="input" dir="auto" placeholder="למשל: הצגת המערכת בישיבת המחלקה, הצעת מחיר" value={step} onChange={(e) => setStep(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">עד תאריך</span>
          <input type="date" className={classNames('input', overdue && !dirty && 'border-red-400')} value={date} onChange={(e) => setDate(e.target.value)} />
          <QuickDates value={date || null} onPick={(d) => setDate(d ?? '')} />
        </label>
      </div>
      {overdue && !dirty && <p className="text-xs font-medium text-red-600">הצעד הבא היה אמור להתבצע עד {formatDate(doctor.next_step_date)}.</p>}
      {dirty && (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setStep(doctor.next_step ?? '')
              setDate(doctor.next_step_date ?? '')
            }}
          >
            ביטול
          </button>
          <button type="button" className="btn-primary" disabled={set.isPending} onClick={() => set.mutate({ id: doctor.id, next_step: step.trim(), next_step_date: date || null })}>
            שמירה
          </button>
        </div>
      )}

      {(history.data ?? []).length > 0 && (
        <div>
          <button type="button" className="flex items-center gap-1 text-sm font-medium text-brand-700" aria-expanded={showHistory} onClick={() => setShowHistory((v) => !v)}>
            <ChevronDown size={15} className={classNames('transition', showHistory && 'rotate-180')} /> היסטוריית השלבים ({history.data?.length})
          </button>
          {showHistory && (
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {(history.data ?? []).map((h) => (
                <li key={h.id}>
                  <span className="text-xs text-slate-400">{formatDate(h.changed_at.slice(0, 10))}</span> · {h.previous_stage ? `${h.previous_stage} ← ` : ''}
                  <span className="font-medium text-slate-800">{h.stage || 'ללא שלב'}</span>
                  {h.by?.full_name ? <span className="text-xs text-slate-400"> · {h.by.full_name}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
