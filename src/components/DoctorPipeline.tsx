import { useEffect, useState } from 'react'
import { Check, ChevronDown, Flag, ListPlus, RotateCcw, XCircle } from 'lucide-react'
import { useSetDoctorPipeline, useStageHistory, usePipelineStages, useStuckThresholds } from '../lib/pipeline'
import { toast } from '../lib/toast'
import { classNames, daysUntil, formatDate, isOverdue, todayISO } from '../lib/utils'
import { QuickDates } from './QuickDates'
import { TaskFormModal } from './TaskFormModal'
import { LOST_REASONS, stuckDaysOf } from '../lib/pipelineStats'

/** a potential doctor's place in the funnel: the stage (tap a stage to move him), the next step, how long he has been in the stage, the history */
export function DoctorPipeline({ doctor }: { doctor: { id: string; pipeline_stage: string; next_step: string; next_step_date: string | null; status: string; lost_reason?: string; lost_at?: string | null } }) {
  const { stages, names, won } = usePipelineStages()
  const history = useStageHistory(doctor.id)
  const thresholds = useStuckThresholds()
  const set = useSetDoctorPipeline()
  const [step, setStep] = useState(doctor.next_step ?? '')
  const [date, setDate] = useState(doctor.next_step_date ?? '')
  const [showHistory, setShowHistory] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [reason, setReason] = useState('')
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(min-width: 640px)').matches)
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
  const hint = stages.find((x) => x.name === current)?.suggested_step ?? ''
  const editorOpen = open || !current || dirty || closing

  function move(stage: string) {
    if (stage === current) return
    const becomesClient = !!won && stage === won && doctor.status === 'potential' && window.confirm(`הרופא הגיע לשלב "${stage}". להפוך אותו ללקוח?`)
    const before = current
    // a doctor without a next step gets the one suggested for the new stage
    const suggestion = stages.find((x) => x.name === stage)?.suggested_step ?? ''
    const fill = !doctor.next_step && !!suggestion
    set.mutate(
      { id: doctor.id, pipeline_stage: stage, ...(fill ? { next_step: suggestion } : {}), ...(becomesClient ? { status: 'client' } : {}) },
      { onSuccess: () => toast(`השלב עודכן: ${stage}`, { action: { label: 'ביטול', run: () => set.mutate({ id: doctor.id, pipeline_stage: before, ...(fill ? { next_step: '' } : {}), ...(becomesClient ? { status: 'potential' } : {}) }) } }) },
    )
  }

  function close() {
    const r = reason.trim()
    set.mutate({ id: doctor.id, status: 'lost', lost_reason: r, lost_at: todayISO() }, { onSuccess: () => (setClosing(false), toast('הרופא נסגר כלא רלוונטי', { action: { label: 'ביטול', run: () => set.mutate({ id: doctor.id, status: 'potential', lost_reason: '', lost_at: null }) } })) })
  }

  if (doctor.status === 'lost')
    return (
      <section className="card flex flex-wrap items-center justify-between gap-3 border-slate-300 bg-slate-50 p-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-700">
            <XCircle size={16} /> נסגר כלא רלוונטי{doctor.lost_at ? ` · ${formatDate(doctor.lost_at)}` : ''}
          </h2>
          <p className="text-sm text-slate-600">{doctor.lost_reason ? `סיבה: ${doctor.lost_reason}` : 'לא צוינה סיבה'}</p>
        </div>
        <button type="button" className="btn-secondary" disabled={set.isPending} onClick={() => set.mutate({ id: doctor.id, status: 'potential', lost_reason: '', lost_at: null })}>
          <RotateCcw size={15} /> החזר לפוטנציאלי
        </button>
      </section>
    )

  return (
    <section className="card space-y-3 p-4 sm:space-y-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-brand-800">
          <Flag size={16} /> משפך
        </h2>
        {current && (
          <span className={classNames('text-xs', daysIn != null && daysIn > stuckDaysOf(thresholds, current) ? 'font-semibold text-amber-700' : 'text-slate-500')}>
            {daysIn != null ? `${daysIn === 0 ? 'נכנס לשלב היום' : `${daysIn} ימים בשלב`}` : ''}
          </span>
        )}
      </div>

      {/* the answer first: the stage and the next step; the editor opens on demand (open by default on a wide screen) */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 text-sm">
          <p className="break-words text-base font-semibold text-slate-800">{current || 'עוד לא נקבע שלב'}</p>
          <p dir="auto" className={classNames('break-words', overdue ? 'font-medium text-red-600' : 'text-slate-600')}>
            {doctor.next_step ? `צעד הבא: ${doctor.next_step}` : 'אין צעד הבא'}
            {doctor.next_step_date ? ` · עד ${formatDate(doctor.next_step_date)}${overdue ? ' (באיחור)' : ''}` : ''}
          </p>
        </div>
        <button type="button" className="btn-secondary shrink-0" aria-expanded={editorOpen} onClick={() => setOpen((v) => !v)}>
          {editorOpen ? 'סגירה' : 'עדכון'}
          <ChevronDown size={15} className={classNames('transition', editorOpen && 'rotate-180')} />
        </button>
      </div>

      {editorOpen && <div className="space-y-4">

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
      {hint && step !== hint && (
        <button type="button" className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100" onClick={() => setStep(hint)}>
          הצעה לשלב הזה: {hint}
        </button>
      )}
      {overdue && !dirty && <p className="text-xs font-medium text-red-600">הצעד הבא היה אמור להתבצע עד {formatDate(doctor.next_step_date)}.</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="btn-secondary !text-xs" disabled={!step.trim()} onClick={() => setTaskOpen(true)} title="פותח משימה עם הצעד הבא והתאריך">
          <ListPlus size={14} /> הפוך למשימה
        </button>
        {!closing && (
          <button type="button" className="btn-ghost !text-xs text-slate-500" onClick={() => setClosing(true)}>
            <XCircle size={14} /> סגור כלא רלוונטי
          </button>
        )}
      </div>
      {closing && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-700">למה הרופא לא יהפוך ללקוח?</p>
          <div className="flex flex-wrap gap-1.5">
            {LOST_REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)} className={classNames('rounded-full border px-3 py-1 text-xs font-medium', reason === r ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100')}>
                {r}
              </button>
            ))}
          </div>
          <input className="input" dir="auto" placeholder="או כתוב סיבה" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setClosing(false)}>
              ביטול
            </button>
            <button type="button" className="btn-primary" disabled={set.isPending} onClick={close}>
              סגור את הרופא
            </button>
          </div>
        </div>
      )}
      {taskOpen && <TaskFormModal defaults={{ description: step.trim(), due_date: date || null, doctor_id: doctor.id }} onClose={() => setTaskOpen(false)} />}
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
      </div>}
    </section>
  )
}
