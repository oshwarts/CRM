import { useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, Check, GraduationCap, Paperclip, Pencil, Plus, Trash2 } from 'lucide-react'
import { useProcedures } from '../lib/api'
import {
  openTrainingFile,
  useDeleteStage,
  useRemoveCompletion,
  useSaveCompletion,
  useSaveStage,
  useSwapStages,
  useTraining,
  useTrainingStages,
} from '../lib/agentsApi'
import { STUCK_DAYS, scopeState, stagesOf } from '../lib/training'
import type { AgentTraining, TrainingStage } from '../lib/types'
import { ConfirmButton, Field, Modal, Spinner } from './ui'
import { classNames, formatDate, todayISO } from '../lib/utils'

/** colour of a scope's cell/badge by how far the agent got */
export const scopeTone = (state: { started: boolean; complete: boolean; stuck: boolean }) =>
  state.stuck
    ? 'border-red-200 bg-red-50 text-red-700'
    : state.complete
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : state.started
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-slate-200 bg-white text-slate-300'

function CompletionModal({ agentId, stage, existing, onClose }: { agentId: string; stage: TrainingStage; existing: AgentTraining | null; onClose: () => void }) {
  const save = useSaveCompletion()
  const remove = useRemoveCompletion()
  const [date, setDate] = useState(existing?.completed_on ?? todayISO())
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [removeFile, setRemoveFile] = useState(false)
  const [error, setError] = useState('')

  async function open() {
    if (!existing?.file_path) return
    const err = await openTrainingFile(existing.file_path)
    if (err) setError(err)
  }

  return (
    <Modal open onClose={onClose} title={`${stage.name} — ${existing ? 'עריכת השלמה' : 'השלמה חדשה'}`} size="md">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          setError('')
          save.mutate(
            { agent_id: agentId, stage_id: stage.id, completed_on: date, notes, file, existing, removeFile },
            { onSuccess: onClose, onError: (er) => setError(er instanceof Error ? er.message : 'השמירה נכשלה') },
          )
        }}
      >
        <Field label="תאריך">
          <input type="date" className="input" required value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="הערות (מדריך, בית חולים, מקרה…)">
          <textarea className="input min-h-16" dir="auto" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Field label="קובץ או אישור (תעודה, מסמך הסמכה)">
          {existing?.file_path && !removeFile && (
            <p className="mb-1 flex items-center gap-2 text-sm">
              <button type="button" className="inline-flex items-center gap-1 text-brand-600 hover:underline" onClick={open}>
                <Paperclip size={14} /> {existing.file_name || 'קובץ'}
              </button>
              <button type="button" className="text-xs text-red-500 hover:underline" onClick={() => setRemoveFile(true)}>
                הסר
              </button>
            </p>
          )}
          <input type="file" className="input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {existing?.file_path && file && !removeFile && <p className="mt-1 text-xs text-slate-400">הקובץ החדש יחליף את הקיים.</p>}
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center justify-between gap-2 pt-1">
          {existing ? (
            <ConfirmButton
              className="btn-ghost text-red-500"
              message="למחוק את ההשלמה? הקובץ המצורף יימחק."
              onConfirm={() => remove.mutate(existing, { onSuccess: onClose, onError: (er) => setError(er instanceof Error ? er.message : 'המחיקה נכשלה') })}
            >
              <Trash2 size={14} /> מחק
            </ConfirmButton>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              ביטול
            </button>
            <button className="btn-primary" disabled={save.isPending}>
              {save.isPending ? 'שומר…' : 'שמור'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

/** managers: define the stages of a scope (general or one procedure): name, how many completions it needs, order */
function StageEditorRow({ stage, prev, next }: { stage: TrainingStage; prev: TrainingStage | null; next: TrainingStage | null }) {
  const save = useSaveStage()
  const swap = useSwapStages()
  const del = useDeleteStage()
  const [name, setName] = useState(stage.name)
  const [count, setCount] = useState(String(stage.required_count))
  const dirty = name.trim() !== stage.name || Number(count) !== stage.required_count
  return (
    <li className="flex flex-wrap items-center gap-2">
      <input className="input !w-48 !py-1 text-sm" dir="auto" value={name} onChange={(e) => setName(e.target.value)} aria-label="שם השלב" />
      <label className="flex items-center gap-1 text-xs text-slate-500">
        נדרשות
        <input type="number" min={1} className="input !w-16 !py-1 text-sm" value={count} onChange={(e) => setCount(e.target.value)} />
      </label>
      {dirty && (
        <button
          className="btn-secondary !py-1 text-xs"
          disabled={!name.trim() || save.isPending}
          onClick={() => save.mutate({ id: stage.id, procedure_id: stage.procedure_id, name, required_count: Number(count), sort: stage.sort })}
        >
          שמור
        </button>
      )}
      <button className="btn-ghost !px-1.5" disabled={!prev} onClick={() => prev && swap.mutate({ a: stage, b: prev })} aria-label="למעלה">
        <ArrowUp size={14} />
      </button>
      <button className="btn-ghost !px-1.5" disabled={!next} onClick={() => next && swap.mutate({ a: stage, b: next })} aria-label="למטה">
        <ArrowDown size={14} />
      </button>
      <ConfirmButton
        className="btn-ghost !px-1.5 text-red-500"
        message={`למחוק את השלב "${stage.name}"? כל ההשלמות שנרשמו בו, לכל הסוכנים, יימחקו.`}
        onConfirm={() => del.mutate(stage)}
      >
        <Trash2 size={14} />
      </ConfirmButton>
    </li>
  )
}

function StagesEditor({ onClose }: { onClose: () => void }) {
  const procedures = useProcedures()
  const stages = useTrainingStages()
  const save = useSaveStage()
  const [newName, setNewName] = useState<Record<string, string>>({})
  const all = stages.data ?? []
  const scopes: { key: string; title: string; procedureId: string | null }[] = [
    { key: 'general', title: 'כללי (לכל הסוכנים, בלי קשר לפרוצדורה)', procedureId: null },
    ...(procedures.data ?? []).map((p) => ({ key: p.id, title: p.name, procedureId: p.id })),
  ]
  return (
    <Modal open onClose={onClose} title="עריכת שלבי ההכשרה" size="xl">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          לכל פרוצדורה אפשר להגדיר שלבים משלה, ושלבים כלליים שחלים על כל סוכן (כמו JR101 וקורס MAKO). בכל שלב קובעים כמה השלמות נדרשות — למשל 6 ניתוחי סולו.
          שינויים משפיעים על כל הסוכנים.
        </p>
        {scopes.map((sc) => {
          const list = stagesOf(all, sc.procedureId)
          return (
            <section key={sc.key} className="rounded-xl border border-slate-200 p-3">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">{sc.title}</h3>
              <ul className="space-y-2">
                {list.map((s, i) => (
                  <StageEditorRow key={`${s.id}-${s.name}-${s.required_count}`} stage={s} prev={list[i - 1] ?? null} next={list[i + 1] ?? null} />
                ))}
              </ul>
              {list.length === 0 && <p className="text-xs text-slate-400">אין שלבים.</p>}
              <form
                className="mt-2 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const name = (newName[sc.key] ?? '').trim()
                  if (!name) return
                  save.mutate(
                    { procedure_id: sc.procedureId, name, required_count: 1, sort: (list[list.length - 1]?.sort ?? -1) + 1 },
                    { onSuccess: () => setNewName((n) => ({ ...n, [sc.key]: '' })) },
                  )
                }}
              >
                <input
                  className="input !w-56 !py-1 text-sm"
                  dir="auto"
                  placeholder="שלב חדש…"
                  value={newName[sc.key] ?? ''}
                  onChange={(e) => setNewName((n) => ({ ...n, [sc.key]: e.target.value }))}
                />
                <button className="btn-secondary !py-1 text-xs" disabled={!(newName[sc.key] ?? '').trim() || save.isPending}>
                  <Plus size={13} /> הוסף
                </button>
              </form>
            </section>
          )
        })}
        <div className="flex justify-end">
          <button className="btn-primary" onClick={onClose}>
            סגור
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** one agent: the general stages and every procedure's stages; the manager records each completion */
export function TrainingPanel({ agentId }: { agentId: string }) {
  const procedures = useProcedures()
  const stages = useTrainingStages()
  const training = useTraining()
  const [modal, setModal] = useState<{ stage: TrainingStage; existing: AgentTraining | null } | null>(null)
  const [editing, setEditing] = useState(false)
  const today = todayISO()

  if (procedures.isLoading || stages.isLoading || training.isLoading) return <Spinner />
  const allStages = stages.data ?? []
  const mine = (training.data ?? []).filter((r) => r.agent_id === agentId)
  const scopes = [
    { key: 'general', title: 'כללי', procedureId: null as string | null },
    ...(procedures.data ?? []).map((p) => ({ key: p.id, title: p.name, procedureId: p.id as string | null })),
  ]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <GraduationCap size={16} className="text-brand-500" />
          לכל שלב מוסיפים השלמה עם תאריך, הערות וקובץ. הכשרה שלא התקדמה {STUCK_DAYS} ימים מסומנת כתקועה. הסוכן רואה את ההתקדמות שלו בדף הבית.
        </p>
        <button className="btn-secondary" onClick={() => setEditing(true)}>
          <Pencil size={14} /> עריכת שלבים
        </button>
      </div>
      <ul className="space-y-2">
        {scopes.map((sc) => {
          const list = stagesOf(allStages, sc.procedureId)
          if (list.length === 0) return null
          const st = scopeState(list, mine, today)
          return (
            <li key={sc.key} className="card p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-slate-800">{sc.title}</span>
                <span className="flex items-center gap-2 text-xs">
                  {st.stuck && (
                    <span className="inline-flex items-center gap-1 text-red-600">
                      <AlertTriangle size={12} /> תקועה {st.daysSince} ימים
                    </span>
                  )}
                  {st.complete ? <span className="text-emerald-600">הושלם</span> : <span className="text-slate-400">{st.doneCount}/{st.total} שלבים</span>}
                </span>
              </div>
              <ul className="space-y-2">
                {st.stages.map((sp) => (
                  <li key={sp.stage.id} className="rounded-lg border border-slate-100 p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                        {sp.done && <Check size={14} className="text-emerald-600" />}
                        {sp.stage.name}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className={classNames('text-xs', sp.done ? 'text-emerald-600' : 'text-slate-500')}>
                          {sp.count}/{sp.stage.required_count}
                        </span>
                        <button className="btn-secondary !py-0.5 text-xs" onClick={() => setModal({ stage: sp.stage, existing: null })}>
                          <Plus size={12} /> השלמה
                        </button>
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className={classNames('h-full', sp.done ? 'bg-emerald-500' : 'bg-brand-500')} style={{ width: `${Math.min(100, (sp.count / sp.stage.required_count) * 100)}%` }} />
                    </div>
                    {sp.rows.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {sp.rows.map((r) => (
                          <button
                            key={r.id}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100"
                            title={r.notes || 'עריכה'}
                            onClick={() => setModal({ stage: sp.stage, existing: r })}
                          >
                            {formatDate(r.completed_on)}
                            {r.file_path && <Paperclip size={10} />}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ul>
      {allStages.length === 0 && <p className="text-sm text-slate-400">עדיין לא הוגדרו שלבי הכשרה. לחץ על "עריכת שלבים".</p>}
      {modal && <CompletionModal agentId={agentId} stage={modal.stage} existing={modal.existing} onClose={() => setModal(null)} />}
      {editing && <StagesEditor onClose={() => setEditing(false)} />}
    </div>
  )
}
