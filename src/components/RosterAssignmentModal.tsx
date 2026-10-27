import { useState } from 'react'
import { Lightbulb, Lock } from 'lucide-react'
import { useClearAssignment, useHospitals, useNotifyAssignmentChange, useSaveAssignment } from '../lib/api'
import { assignmentChangeMessage, SHIFT_LABELS, WORK_TYPES, WORK_TYPE_LABELS, type AssignmentRow, type RosterShift, type Suggestion } from '../lib/roster'
import { formatDate } from '../lib/utils'
import { Field, Modal } from './ui'

export type LinkOption = { id: string; label: string; hospitalId: string | null }

/** where one agent works on one shift: hospital / free-text area, kind of work, a link to the task or meeting it is for — with the system's suggestions one tap away */
export function RosterAssignmentModal({
  agentName,
  agentId,
  date,
  shift,
  weekStart,
  isClosed,
  current,
  suggestions,
  taskOptions,
  meetingOptions,
  onClose,
}: {
  agentName: string
  agentId: string
  date: string
  shift: RosterShift
  weekStart: string
  /** the week this shift falls in was already closed by a manager: saving now notifies the agent */
  isClosed: boolean
  current: AssignmentRow | null
  suggestions: Suggestion[]
  taskOptions: LinkOption[]
  meetingOptions: LinkOption[]
  onClose: () => void
}) {
  const hospitals = useHospitals()
  const save = useSaveAssignment()
  const clear = useClearAssignment()
  const notify = useNotifyAssignmentChange()
  const [hospitalId, setHospitalId] = useState(current?.hospital_id ?? '')
  const [area, setArea] = useState(current?.area ?? '')
  const [workType, setWorkType] = useState(current?.work_type ?? 'field')
  const [note, setNote] = useState(current?.note ?? '')
  const [link, setLink] = useState(current?.task_id ? `task:${current.task_id}` : current?.meeting_id ? `meeting:${current.meeting_id}` : '')
  const [error, setError] = useState('')

  const pickSuggestion = (s: Suggestion) => {
    setHospitalId(s.hospitalId ?? '')
    setWorkType('field')
  }
  const pickLink = (value: string) => {
    setLink(value)
    const [kind, id] = value.split(':')
    const opt = (kind === 'task' ? taskOptions : meetingOptions).find((o) => o.id === id)
    if (opt?.hospitalId) {
      setHospitalId(opt.hospitalId)
      setWorkType('field')
    }
  }

  function notifyIfClosed(next: AssignmentRow | null) {
    if (!isClosed) return
    notify.mutate({ agent_id: agentId, week_start: weekStart, date, shift, message: assignmentChangeMessage(date, shift, next) })
  }

  function submit() {
    setError('')
    const [kind, id] = link.split(':')
    const next: AssignmentRow = { agent_id: agentId, date, shift, hospital_id: hospitalId || null, area, work_type: workType, task_id: kind === 'task' ? id : null, meeting_id: kind === 'meeting' ? id : null, note }
    save.mutate(next, {
      onSuccess: () => {
        notifyIfClosed(next)
        onClose()
      },
      onError: () => setError('השמירה נכשלה, נסה שוב'),
    })
  }

  return (
    <Modal open onClose={onClose} title={`שיבוץ — ${agentName}`} size="md">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          {formatDate(date)} · {SHIFT_LABELS[shift]}
        </p>

        {isClosed && (
          <p className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <Lock size={13} aria-hidden /> השבוע הזה כבר נסגר ופורסם. שמירה כאן עדיין אפשרית, ותשלח עדכון אישי ל{agentName}.
          </p>
        )}

        {suggestions.length > 0 && (
          <div className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
              <Lightbulb size={13} aria-hidden /> הצעות המערכת
            </p>
            {suggestions.map((s) => (
              <button
                key={s.hospitalId ?? 'none'}
                type="button"
                className="block w-full rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-start text-sm hover:bg-amber-100/60"
                onClick={() => pickSuggestion(s)}
              >
                <span className="font-medium text-slate-800">{s.hospitalName}</span>
                <span className="mr-2 text-xs text-slate-500">{s.reasons[0]}</span>
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="סוג עבודה">
            <select className="input" value={workType} onChange={(e) => setWorkType(e.target.value as typeof workType)}>
              {WORK_TYPES.map((w) => (
                <option key={w} value={w}>
                  {WORK_TYPE_LABELS[w]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="בית חולים">
            <select className="input" value={hospitalId} onChange={(e) => setHospitalId(e.target.value)} disabled={workType !== 'field'}>
              <option value="">—</option>
              {(hospitals.data ?? []).map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </Field>
          {(taskOptions.length > 0 || meetingOptions.length > 0) && (
            <Field label="קישור למשימה / פגישה של הסוכן ביום זה" className="sm:col-span-2">
              <select className="input" value={link} onChange={(e) => pickLink(e.target.value)}>
                <option value="">— ללא קישור —</option>
                {meetingOptions.length > 0 && (
                  <optgroup label="פגישות">
                    {meetingOptions.map((o) => (
                      <option key={`meeting:${o.id}`} value={`meeting:${o.id}`}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                )}
                {taskOptions.length > 0 && (
                  <optgroup label="משימות">
                    {taskOptions.map((o) => (
                      <option key={`task:${o.id}`} value={`task:${o.id}`}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </Field>
          )}
          <Field label="אזור / מיקום (חופשי)" className="sm:col-span-2">
            <input className="input" dir="auto" autoComplete="off" value={area} onChange={(e) => setArea(e.target.value)} placeholder="למשל: צפון, משרד תל אביב" />
          </Field>
          <Field label="הערה" className="sm:col-span-2">
            <input className="input" dir="auto" autoComplete="off" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          {current ? (
            <button
              type="button"
              className="btn-ghost text-red-600"
              disabled={clear.isPending}
              onClick={() =>
                clear.mutate(
                  { agent_id: agentId, date, shift },
                  {
                    onSuccess: () => {
                      notifyIfClosed(null)
                      onClose()
                    },
                    onError: () => setError('המחיקה נכשלה'),
                  },
                )
              }
            >
              מחיקת שיבוץ
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              ביטול
            </button>
            <button type="button" className="btn-primary" disabled={save.isPending} onClick={submit}>
              {save.isPending ? 'שומר…' : 'שמירה'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
