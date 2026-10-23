import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Check, Plus, Trash2 } from 'lucide-react'
import { useAgents } from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import { toast } from '../lib/toast'
import { actingUserId } from '../lib/actingAs'
import { classNames, formatDate, todayISO } from '../lib/utils'
import { canClose, KIND_LABELS, progress } from '../lib/processLogic'
import { useAddStep, useDeleteProcess, useDeleteStep, useProcesses, useSetStepDone, useUpdateProcess, useUpdateStep, type Step } from '../lib/processes'
import { ProgressBar } from '../components/ProcessPanels'
import { ConfirmButton, EmptyState, ErrorState, Spinner } from '../components/ui'

/** one process: its steps (tasks of the system) with the owner, the date and the notes; a manager edits everything, an agent ticks his own steps */
export default function ProcessView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin, user } = useAuth()
  const processes = useProcesses()
  const agents = useAgents()
  const updateStep = useUpdateStep()
  const setDone = useSetStepDone()
  const addStep = useAddStep()
  const delStep = useDeleteStep()
  const update = useUpdateProcess()
  const delProcess = useDeleteProcess()
  const [newStep, setNewStep] = useState('')
  const today = todayISO()

  if (processes.isLoading) return <Spinner />
  if (processes.error && !processes.data) return <ErrorState error={processes.error} />
  const p = (processes.data ?? []).find((x) => x.id === id)
  if (!p) return <EmptyState title="התהליך לא נמצא" hint="ייתכן שהוא נמחק או שאינו משויך אליך" action={<Link to="/processes" className="btn-primary">לתהליכים</Link>} />

  const pr = progress(p.steps, today)
  const nameOf = (uid: string | null) => (agents.data ?? []).find((a) => a.id === uid)?.full_name ?? ''
  const fail = (e: unknown) => toast(e instanceof Error ? e.message : 'הפעולה נכשלה', { kind: 'error' })

  const row = (s: Step) => {
    const mine = s.assignee_id === user?.id
    const canTick = isAdmin || mine
    const late = !s.is_done && s.due_date && s.due_date < today
    return (
      <li key={s.id} className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex items-start gap-1.5">
          <button
            type="button"
            role="checkbox"
            aria-checked={s.is_done}
            disabled={!canTick}
            aria-label={s.is_done ? `החזר לפתוח: ${s.description}` : `סמן כבוצע: ${s.description}`}
            onClick={() => setDone.mutate({ id: s.id, done: !s.is_done }, { onError: fail })}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full disabled:opacity-50"
          >
            <span className={classNames('grid h-6 w-6 place-items-center rounded-full border-2 transition', s.is_done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white')}>
              {s.is_done && <Check size={14} aria-hidden />}
            </span>
          </button>
          {isAdmin ? (
            <div className="min-w-0 flex-1 space-y-1.5 py-1">
              <input className="input" dir="auto" aria-label="שם השלב" defaultValue={s.description} onBlur={(e) => e.target.value.trim() && e.target.value !== s.description && updateStep.mutate({ id: s.id, patch: { description: e.target.value.trim() } }, { onError: fail })} />
              <input className="input" dir="auto" placeholder="הערות" aria-label="הערות לשלב" defaultValue={s.notes} onBlur={(e) => e.target.value !== s.notes && updateStep.mutate({ id: s.id, patch: { notes: e.target.value } }, { onError: fail })} />
              <div className="grid grid-cols-2 gap-2">
                <select className="input" aria-label="אחראי" value={s.assignee_id ?? ''} onChange={(e) => updateStep.mutate({ id: s.id, patch: { assignee_id: e.target.value || null } }, { onError: fail })}>
                  {(agents.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.full_name || a.email}</option>)}
                </select>
                <input type="date" className="input" aria-label="תאריך יעד" value={s.due_date ?? ''} onChange={(e) => updateStep.mutate({ id: s.id, patch: { due_date: e.target.value || null } }, { onError: fail })} />
              </div>
            </div>
          ) : (
            <div className="min-w-0 flex-1 py-1">
              <p dir="auto" className={classNames('[overflow-wrap:anywhere]', s.is_done && 'text-slate-400 line-through')}>{s.description}</p>
              {s.notes && <p dir="auto" className="text-xs text-slate-500">{s.notes}</p>}
              <p className="text-xs text-slate-500">{nameOf(s.assignee_id)}{s.due_date ? ` · עד ${formatDate(s.due_date)}` : ''}</p>
            </div>
          )}
          {isAdmin && (
            <button type="button" className="btn-ghost !min-h-10 !px-2 text-red-600" aria-label={`מחיקת השלב ${s.description}`} onClick={() => window.confirm('למחוק את השלב?') && delStep.mutate(s.id, { onError: fail })}>
              <Trash2 size={16} aria-hidden />
            </button>
          )}
        </div>
        {late && <p className="ps-12 text-xs font-medium text-red-600">באיחור</p>}
      </li>
    )
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div>
        <Link to="/processes" className="inline-flex min-h-[40px] items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
          <ArrowRight size={14} aria-hidden /> לתהליכים
        </Link>
        {isAdmin ? (
          <input className="input !text-xl font-semibold text-brand-800" dir="auto" aria-label="שם התהליך" defaultValue={p.name} onBlur={(e) => e.target.value.trim() && e.target.value !== p.name && update.mutate({ id: p.id, patch: { name: e.target.value.trim() } }, { onError: fail })} />
        ) : (
          <h1 dir="auto" className="text-2xl font-semibold text-brand-800">{p.name}</h1>
        )}
        <p className="mt-1 text-sm text-slate-500">
          {KIND_LABELS[p.kind]} · התחיל ב-{formatDate(p.start_date)}
          {p.agent && <> · <Link to={`/agents/${p.agent.id}`} className="text-brand-700 hover:underline">{p.agent.full_name}</Link></>}
          {p.hospital && <> · <Link to={`/hospitals/${p.hospital.id}`} className="text-brand-700 hover:underline">{p.hospital.name}</Link></>}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1"><ProgressBar percent={pr.percent} /></div>
        <span className="shrink-0 text-sm">{pr.done}/{pr.total}{pr.overdue > 0 ? ` · ${pr.overdue} באיחור` : ''}</span>
      </div>

      <ul className="space-y-2">{p.steps.map(row)}</ul>

      {isAdmin && (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!newStep.trim()) return
            addStep.mutate({ process: p, description: newStep, assignee_id: (await actingUserId()) ?? null, due_date: null }, { onSuccess: () => setNewStep(''), onError: fail })
          }}
        >
          <input className="input min-w-0 flex-1" dir="auto" placeholder="שלב נוסף…" aria-label="שלב נוסף" value={newStep} onChange={(e) => setNewStep(e.target.value)} />
          <button className="btn-secondary shrink-0" disabled={!newStep.trim() || addStep.isPending}><Plus size={16} aria-hidden /> הוסף</button>
        </form>
      )}

      {isAdmin && (
        <div className="space-y-2 border-t border-slate-200 pt-3">
          <textarea className="input min-h-16" dir="auto" placeholder="הערות לתהליך" aria-label="הערות לתהליך" defaultValue={p.notes} onBlur={(e) => e.target.value !== p.notes && update.mutate({ id: p.id, patch: { notes: e.target.value } }, { onError: fail })} />
          <div className="flex flex-wrap gap-2">
            {p.status === 'open' ? (
              <button className="btn-primary" disabled={!canClose(p.steps)} title={canClose(p.steps) ? '' : 'כל השלבים צריכים להיות מסומנים כבוצעו'} onClick={async () => update.mutate({ id: p.id, patch: { status: 'closed', closed_on: today, closed_by: await actingUserId() } }, { onError: fail })}>
                סגירת התהליך
              </button>
            ) : (
              <button className="btn-secondary" onClick={() => update.mutate({ id: p.id, patch: { status: 'open', closed_on: null, closed_by: null } }, { onError: fail })}>פתיחה מחדש</button>
            )}
            <ConfirmButton className="btn-ghost !text-red-600" message={`למחוק את התהליך "${p.name}" ואת כל השלבים שלו (המשימות)? אי אפשר לבטל.`} label={`מחיקת ${p.name}`} onConfirm={() => delProcess.mutate(p.id, { onSuccess: () => navigate('/processes'), onError: fail })}>
              <Trash2 size={16} aria-hidden /> מחיקת התהליך
            </ConfirmButton>
          </div>
        </div>
      )}
    </div>
  )
}
