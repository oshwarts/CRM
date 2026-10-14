import { useState } from 'react'
import { AlertTriangle, Check, GraduationCap, Paperclip, Trash2 } from 'lucide-react'
import { useProcedures } from '../lib/api'
import { openTrainingFile, useRemoveTrainingStage, useSaveTrainingStage, useTraining } from '../lib/agentsApi'
import { TRAINING_STAGES, STUCK_DAYS, trainingOf, trainingState } from '../lib/training'
import type { AgentTraining } from '../lib/types'
import { ConfirmButton, Field, Modal, Spinner } from './ui'
import { classNames, formatDate, todayISO } from '../lib/utils'

/** colour of a procedure's cell by how far the agent got */
export const stageTone = (top: number, certified: boolean, stuck: boolean) =>
  stuck
    ? 'border-red-200 bg-red-50 text-red-700'
    : certified
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : top >= 3
        ? 'border-sky-200 bg-sky-50 text-sky-700'
        : top >= 0
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-slate-200 bg-white text-slate-300'

function StageModal({
  agentId,
  procedureId,
  procedureName,
  stage,
  existing,
  onClose,
}: {
  agentId: string
  procedureId: string
  procedureName: string
  stage: (typeof TRAINING_STAGES)[number]
  existing: AgentTraining | null
  onClose: () => void
}) {
  const save = useSaveTrainingStage()
  const remove = useRemoveTrainingStage()
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
    <Modal open onClose={onClose} title={`${procedureName} — ${stage.label}`} size="md">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          setError('')
          save.mutate(
            { agent_id: agentId, procedure_id: procedureId, stage: stage.key, completed_on: date, notes, file, existing, removeFile },
            { onSuccess: onClose, onError: (er) => setError(er instanceof Error ? er.message : 'השמירה נכשלה') },
          )
        }}
      >
        <Field label="תאריך השלמה">
          <input type="date" className="input" required value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="הערות (מדריך, מקרים, מה נשאר…)">
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
              message="לבטל את השלמת השלב? הקובץ המצורף יימחק."
              onConfirm={() => remove.mutate(existing, { onSuccess: onClose, onError: (er) => setError(er instanceof Error ? er.message : 'המחיקה נכשלה') })}
            >
              <Trash2 size={14} /> בטל השלמה
            </ConfirmButton>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              ביטול
            </button>
            <button className="btn-primary" disabled={save.isPending}>
              {save.isPending ? 'שומר…' : existing ? 'שמור' : 'סמן כהושלם'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

/** one agent: every procedure with its stages, the manager marks them as completed */
export function TrainingPanel({ agentId }: { agentId: string }) {
  const procedures = useProcedures()
  const training = useTraining()
  const [modal, setModal] = useState<{ procId: string; procName: string; stage: (typeof TRAINING_STAGES)[number] } | null>(null)
  const today = todayISO()

  if (procedures.isLoading || training.isLoading) return <Spinner />
  const all = training.data ?? []

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <GraduationCap size={16} className="text-brand-500" />
        לחץ על שלב כדי לסמן שהושלם (תאריך, הערות וקובץ). הסוכן רואה את ההתקדמות שלו בדף הבית. הכשרה שלא התקדמה {STUCK_DAYS} ימים מסומנת כתקועה.
      </p>
      <ul className="space-y-2">
        {(procedures.data ?? []).map((p) => {
          const rows = trainingOf(all, agentId, p.id)
          const st = trainingState(rows, today)
          return (
            <li key={p.id} className="card p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-slate-800">{p.name}</span>
                <span className="flex items-center gap-2 text-xs">
                  {st.stuck && (
                    <span className="inline-flex items-center gap-1 text-red-600">
                      <AlertTriangle size={12} /> תקועה {st.daysSince} ימים
                    </span>
                  )}
                  {st.certified && <span className="text-emerald-600">מוסמך</span>}
                  {st.top < 0 && <span className="text-slate-300">לא התחיל</span>}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                {TRAINING_STAGES.map((s, i) => {
                  const r = st.done.get(s.key)
                  const next = !r && i === st.top + 1
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setModal({ procId: p.id, procName: p.name, stage: s })}
                      className={classNames(
                        'rounded-lg border px-2 py-1.5 text-right text-xs transition',
                        r ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : next ? 'border-brand-300 bg-white text-brand-700 hover:bg-brand-50' : 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100',
                      )}
                    >
                      <span className="flex items-center gap-1 font-medium">
                        {r && <Check size={12} />}
                        {s.label}
                        {r?.file_path && <Paperclip size={11} />}
                      </span>
                      <span className="block text-[11px]">{r ? formatDate(r.completed_on) : next ? 'הבא בתור' : ''}</span>
                    </button>
                  )
                })}
              </div>
            </li>
          )
        })}
      </ul>
      {modal && (
        <StageModal
          agentId={agentId}
          procedureId={modal.procId}
          procedureName={modal.procName}
          stage={modal.stage}
          existing={trainingOf(all, agentId, modal.procId).find((r) => r.stage === modal.stage.key) ?? null}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
