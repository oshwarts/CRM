import { useState } from 'react'
import { Lightbulb } from 'lucide-react'
import { useClearAssignment, useHospitals, useSaveAssignment } from '../lib/api'
import { SHIFT_LABELS, WORK_TYPES, WORK_TYPE_LABELS, type AssignmentRow, type RosterShift, type Suggestion } from '../lib/roster'
import { formatDate } from '../lib/utils'
import { Field, Modal } from './ui'

/** where one agent works on one shift: hospital / free-text area, kind of work, a note — with the system's suggestions one tap away */
export function RosterAssignmentModal({
  agentName,
  agentId,
  date,
  shift,
  current,
  suggestions,
  onClose,
}: {
  agentName: string
  agentId: string
  date: string
  shift: RosterShift
  current: AssignmentRow | null
  suggestions: Suggestion[]
  onClose: () => void
}) {
  const hospitals = useHospitals()
  const save = useSaveAssignment()
  const clear = useClearAssignment()
  const [hospitalId, setHospitalId] = useState(current?.hospital_id ?? '')
  const [area, setArea] = useState(current?.area ?? '')
  const [workType, setWorkType] = useState(current?.work_type ?? 'field')
  const [note, setNote] = useState(current?.note ?? '')
  const [error, setError] = useState('')

  function submit() {
    setError('')
    save.mutate(
      { agent_id: agentId, date, shift, hospital_id: hospitalId || null, area, work_type: workType, task_id: current?.task_id ?? null, meeting_id: current?.meeting_id ?? null, note },
      { onSuccess: onClose, onError: () => setError('השמירה נכשלה, נסה שוב') },
    )
  }

  return (
    <Modal open onClose={onClose} title={`שיבוץ — ${agentName}`} size="md">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          {formatDate(date)} · {SHIFT_LABELS[shift]}
        </p>

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
                onClick={() => {
                  setHospitalId(s.hospitalId ?? '')
                  setWorkType('field')
                }}
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
              onClick={() => clear.mutate({ agent_id: agentId, date, shift }, { onSuccess: onClose, onError: () => setError('המחיקה נכשלה') })}
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
              שמירה
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
