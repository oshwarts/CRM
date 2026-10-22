import { useState } from 'react'
import { Flame, ListChecks, Plus, Repeat, User } from 'lucide-react'
import { useSetTaskDone, useTasks } from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import { TaskFormModal } from './TaskFormModal'
import type { TaskRow } from '../lib/types'
import { classNames, daysUntil, formatDate } from '../lib/utils'

/** the tasks linked to one doctor or one hospital — shown on the doctor profile and in the hospital panel */
export function useLinkedTasks(opts: { doctorId?: string; hospitalId?: string }) {
  const tasks = useTasks()
  const list = (tasks.data ?? []).filter((t) =>
    opts.doctorId ? t.doctor_id === opts.doctorId : opts.hospitalId ? t.hospital_id === opts.hospitalId : false,
  )
  return { ...tasks, list, open: list.filter((t) => !t.is_done) }
}

export function LinkedTasks({ doctorId, hospitalId }: { doctorId?: string; hospitalId?: string }) {
  const { user, isAdmin } = useAuth()
  const { list, open, isLoading } = useLinkedTasks({ doctorId, hospitalId })
  const setDone = useSetTaskDone()
  const [showDone, setShowDone] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<TaskRow | null>(null)

  const done = list.filter((t) => t.is_done)
  const shown = showDone ? [...open, ...done] : open

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1 text-xs font-medium uppercase text-slate-400">
          <ListChecks size={12} /> משימות ({open.length})
        </p>
        <button type="button" className="inline-flex min-h-[40px] items-center gap-1 px-2 text-sm font-medium text-brand-600 hover:underline" onClick={() => setAdding(true)}>
          <Plus size={14} aria-hidden /> משימה
        </button>
      </div>

      {isLoading ? null : shown.length === 0 ? (
        <p className="text-sm text-slate-500">אין משימות פתוחות</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
          {shown.map((t) => {
            const d = daysUntil(t.due_date)
            const subs = t.subtasks.length
            return (
              <li key={t.id} className="flex items-start gap-3 px-3 py-2">
                <label className="-my-2 -ms-2 grid h-11 w-11 shrink-0 cursor-pointer place-items-center">
                  <input
                    type="checkbox"
                    className="h-5 w-5 cursor-pointer accent-emerald-600"
                    checked={t.is_done}
                    onChange={(e) => setDone.mutate({ task: t, done: e.target.checked })}
                    aria-label={`סמן כבוצע: ${t.description}`}
                  />
                </label>
                <button type="button" className="min-h-[40px] min-w-0 flex-1 py-0.5 text-right" onClick={() => setEditing(t)}>
                  <span dir="auto" className={classNames('block whitespace-pre-line break-words text-sm', t.is_done ? 'text-slate-400 line-through' : 'text-slate-800')}>
                    {t.description}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
                    {t.due_date && (
                      <span className={classNames(!t.is_done && d !== null && d < 0 && 'font-medium text-red-600', !t.is_done && d === 0 && 'font-medium text-amber-600')}>
                        {d === 0 ? 'היום' : d === 1 ? 'מחר' : formatDate(t.due_date)}
                      </span>
                    )}
                    {t.priority === 'urgent' && !t.is_done && (
                      <span className="inline-flex items-center gap-0.5 text-red-500">
                        <Flame size={11} /> דחוף
                      </span>
                    )}
                    {t.recurrence !== 'none' && <Repeat size={11} />}
                    {subs > 0 && (
                      <span>
                        {t.subtasks.filter((s) => s.is_done).length}/{subs} שלבים
                      </span>
                    )}
                    {isAdmin && t.assignee && t.assignee.id !== user?.id && (
                      <span className="inline-flex items-center gap-0.5 text-violet-700">
                        <User size={11} /> {t.assignee.full_name}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {done.length > 0 && (
        <button type="button" className="min-h-[40px] text-sm text-slate-500 hover:underline" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)}>
          {showDone ? 'הסתר משימות שבוצעו' : `הצג משימות שבוצעו (${done.length})`}
        </button>
      )}

      {adding && (
        <TaskFormModal
          onClose={() => setAdding(false)}
          defaults={{ doctor_id: doctorId ?? null, hospital_id: hospitalId ?? null }}
        />
      )}
      {editing && <TaskFormModal task={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
