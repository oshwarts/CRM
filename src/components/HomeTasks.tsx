import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Flame, ListChecks } from 'lucide-react'
import { useSetTaskDone, useTasks } from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import { TaskFormModal } from './TaskFormModal'
import { classNames, daysUntil, formatDate } from '../lib/utils'

/** my tasks that need attention: overdue, due in the next 3 days, or urgent */
export function HomeTasks() {
  const { user } = useAuth()
  const tasks = useTasks()
  const setDone = useSetTaskDone()
  const [adding, setAdding] = useState(false)

  const mine = (tasks.data ?? []).filter((t) => !t.is_done && t.assignee_id === user?.id)
  const attention = mine
    .filter((t) => {
      const d = daysUntil(t.due_date)
      return t.priority === 'urgent' || (d !== null && d <= 3)
    })
    .sort((a, b) => (daysUntil(a.due_date) ?? 99) - (daysUntil(b.due_date) ?? 99))
  const overdue = attention.filter((t) => (daysUntil(t.due_date) ?? 0) < 0).length

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-slate-800">
          <ListChecks size={18} className="text-brand-500" />
          המשימות שלי
          {overdue > 0 && <span className="chip border-red-200 bg-red-50 !px-2 !py-0 text-xs text-red-600">{overdue} באיחור</span>}
        </h2>
        <div className="flex items-center gap-3">
          <button className="text-sm font-medium text-brand-600 hover:underline" onClick={() => setAdding(true)}>
            + משימה
          </button>
          <Link to="/tasks" className="text-sm font-medium text-brand-600 hover:underline">
            לכל המשימות ({mine.length}) →
          </Link>
        </div>
      </div>

      {attention.length === 0 ? (
        <p className="text-sm text-slate-400">
          {mine.length ? 'אין משימות דחופות או לימים הקרובים.' : 'אין משימות פתוחות.'}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {attention.slice(0, 6).map((t) => {
            const d = daysUntil(t.due_date)
            return (
              <li key={t.id} className="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  className="h-6 w-6 shrink-0 cursor-pointer accent-emerald-600"
                  checked={false}
                  onChange={() => setDone.mutate({ task: t, done: true })}
                  aria-label="סמן כבוצע"
                />
                <Link to="/tasks" dir="auto" className="min-w-0 flex-1 truncate text-sm text-slate-800">
                  {t.description}
                </Link>
                {t.priority === 'urgent' && <Flame size={14} className="shrink-0 text-red-500" />}
                {t.due_date && (
                  <span
                    className={classNames(
                      'shrink-0 text-xs',
                      d !== null && d < 0 ? 'font-medium text-red-600' : d === 0 ? 'font-medium text-amber-600' : 'text-slate-400',
                    )}
                  >
                    {d === 0 ? 'היום' : d === 1 ? 'מחר' : formatDate(t.due_date)}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {attention.length > 6 && <p className="mt-1 text-xs text-slate-400">ועוד {attention.length - 6}…</p>}
      {adding && <TaskFormModal onClose={() => setAdding(false)} />}
    </section>
  )
}
