import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useAgents, useDeleteTask, useDoctors, useHospitals, useSaveTask, type TaskFormData } from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import type { TaskRow } from '../lib/types'
import { ConfirmButton, Field, Modal } from './ui'

const emptyForm = (assignee: string | null): TaskFormData => ({
  description: '',
  notes: '',
  due_date: null,
  priority: 'normal',
  doctor_id: null,
  hospital_id: null,
  recurrence: 'none',
  assignee_id: assignee,
  subtasks: [],
})

/** create / edit a task. `defaults` pre-fills a new task (e.g. the doctor to follow up with). */
export function TaskFormModal({
  task,
  defaults,
  onClose,
}: {
  task?: TaskRow | null
  defaults?: Partial<TaskFormData>
  onClose: () => void
}) {
  const { user, isAdmin } = useAuth()
  const agents = useAgents()
  const doctors = useDoctors()
  const hospitals = useHospitals()
  const save = useSaveTask()
  const del = useDeleteTask()

  const [d, setD] = useState<TaskFormData>(() =>
    task
      ? {
          id: task.id,
          description: task.description,
          notes: task.notes,
          due_date: task.due_date,
          priority: task.priority === 'urgent' ? 'urgent' : 'normal',
          doctor_id: task.doctor_id,
          hospital_id: task.hospital_id,
          recurrence: (task.recurrence as TaskFormData['recurrence']) ?? 'none',
          assignee_id: task.assignee_id,
          subtasks: task.subtasks.map((s) => ({ id: s.id, text: s.text, is_done: s.is_done })),
        }
      : { ...emptyForm(user?.id ?? null), ...defaults },
  )
  const [error, setError] = useState('')
  const set = (p: Partial<TaskFormData>) => setD((x) => ({ ...x, ...p }))

  async function submit() {
    setError('')
    if (!d.description.trim()) return setError('כתוב מה המשימה')
    try {
      await save.mutateAsync(d)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'השמירה נכשלה')
    }
  }

  const setSub = (i: number, p: Partial<TaskFormData['subtasks'][number]>) =>
    set({ subtasks: d.subtasks.map((s, k) => (k === i ? { ...s, ...p } : s)) })

  return (
    <Modal open onClose={onClose} title={task ? 'עריכת משימה' : 'משימה חדשה'} size="lg">
      <div className="space-y-4">
        <Field label="המשימה">
          <textarea
            className="input min-h-20"
            dir="auto"
            autoFocus
            placeholder="מה צריך לעשות?"
            value={d.description}
            onChange={(e) => set({ description: e.target.value })}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="תאריך יעד">
            <input type="date" className="input" value={d.due_date ?? ''} onChange={(e) => set({ due_date: e.target.value || null })} />
          </Field>
          <Field label="עדיפות">
            <select className="input" value={d.priority} onChange={(e) => set({ priority: e.target.value as TaskFormData['priority'] })}>
              <option value="normal">רגילה</option>
              <option value="urgent">דחוף</option>
            </select>
          </Field>
          <Field label="חוזרת">
            <select className="input" value={d.recurrence} onChange={(e) => set({ recurrence: e.target.value as TaskFormData['recurrence'] })}>
              <option value="none">לא</option>
              <option value="weekly">כל שבוע</option>
              <option value="monthly">כל חודש</option>
            </select>
          </Field>
        </div>
        {d.recurrence !== 'none' && (
          <p className="-mt-2 text-xs text-slate-400">אחרי סימון "בוצע" תיווצר אוטומטית המשימה הבאה (דורש תאריך יעד).</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="רופא (אופציונלי)">
            <select className="input" value={d.doctor_id ?? ''} onChange={(e) => set({ doctor_id: e.target.value || null })}>
              <option value="">—</option>
              {(doctors.data ?? []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="בית חולים (אופציונלי)">
            <select className="input" value={d.hospital_id ?? ''} onChange={(e) => set({ hospital_id: e.target.value || null })}>
              <option value="">—</option>
              {(hospitals.data ?? []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {isAdmin && (
          <Field label="סוכן אחראי">
            <select className="input" value={d.assignee_id ?? ''} onChange={(e) => set({ assignee_id: e.target.value || null })}>
              {(agents.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name || a.email}
                  {a.id === user?.id ? ' (אני)' : ''}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="פרטים והערות (אופציונלי)">
          <textarea className="input min-h-16" dir="auto" value={d.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>

        <div>
          <span className="label">שלבים / תתי-משימות</span>
          <ul className="space-y-2">
            {d.subtasks.map((s, i) => (
              <li key={s.id ?? i} className="flex items-center gap-2">
                <input type="checkbox" className="h-5 w-5" checked={s.is_done} onChange={(e) => setSub(i, { is_done: e.target.checked })} />
                <input
                  className="input !py-1.5"
                  dir="auto"
                  value={s.text}
                  placeholder="שלב"
                  onChange={(e) => setSub(i, { text: e.target.value })}
                />
                <button type="button" className="btn-ghost !px-2 text-slate-400" onClick={() => set({ subtasks: d.subtasks.filter((_, k) => k !== i) })} aria-label="הסר שלב">
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn-ghost mt-2" onClick={() => set({ subtasks: [...d.subtasks, { text: '', is_done: false }] })}>
            <Plus size={16} />
            הוסף שלב
          </button>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-4">
          <div>
            {task && (
              <ConfirmButton
                message="למחוק את המשימה?"
                onConfirm={() => del.mutate(task.id, { onSuccess: onClose, onError: (e) => setError(e instanceof Error ? e.message : 'המחיקה נכשלה') })}
              >
                מחיקה
              </ConfirmButton>
            )}
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={onClose}>
              ביטול
            </button>
            <button className="btn-primary" onClick={submit} disabled={save.isPending}>
              {save.isPending ? 'שומר…' : 'שמירה'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
