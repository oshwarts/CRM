import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Flame, ListChecks } from 'lucide-react'
import { useSetTaskDone, useTasks } from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import { TaskFormModal } from './TaskFormModal'
import { classNames, daysUntil, formatDate } from '../lib/utils'

/** my tasks that need attention: overdue, due in the next 3 days, or urgent */
export function HomeTasks({ embedded = false }: { embedded?: boolean }) {
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
    <section className={embedded ? '' : 'card p-4 sm:p-5'}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-0">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-brand-700">
          <ListChecks size={13} aria-hidden />
          המשימות שלי
          {overdue > 0 && <span className="chip whitespace-nowrap border-red-200 bg-red-50 !px-2 !py-0 text-xs text-red-600">{overdue} באיחור</span>}
        </h3>
        <div className="flex items-center gap-4">
          <button className="inline-flex min-h-[32px] items-center whitespace-nowrap text-sm font-medium text-brand-600 hover:underline" onClick={() => setAdding(true)}>
            + משימה
          </button>
          <Link to="/tasks" className="inline-flex min-h-[32px] items-center whitespace-nowrap text-sm font-medium text-brand-600 hover:underline">
            כל המשימות ({mine.length}) ←
          </Link>
        </div>
      </div>

      {attention.length === 0 ? (
        <p className="text-sm text-slate-600">
          {mine.length ? 'אין משימות דחופות או לימים הקרובים.' : 'אין משימות פתוחות.'}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {attention.slice(0, 6).map((t) => {
            const d = daysUntil(t.due_date)
            return (
              <li key={t.id} className="flex items-center gap-1 py-0.5">
                <label className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center">
                  <input
                    type="checkbox"
                    className="h-6 w-6 cursor-pointer accent-emerald-600"
                    checked={false}
                    onChange={() => setDone.mutate({ task: t, done: true })}
                    aria-label={`סמן כבוצע: ${t.description}`}
                  />
                </label>
                <Link to="/tasks" dir="auto" className="flex min-h-[44px] min-w-0 flex-1 items-center text-sm text-slate-800">
                  <span className="line-clamp-2 break-words">{t.description}</span>
                </Link>
                {t.priority === 'urgent' && <Flame size={14} role="img" aria-label="דחוף" className="shrink-0 text-red-500" />}
                {t.due_date && (
                  <span
                    className={classNames(
                      'shrink-0 text-xs',
                      d !== null && d < 0 ? 'font-medium text-red-600' : d === 0 ? 'font-medium text-amber-700' : 'text-slate-600',
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
      {attention.length > 6 && <p className="mt-1 text-xs text-slate-600">ועוד {attention.length - 6}…</p>}
      {adding && <TaskFormModal onClose={() => setAdding(false)} />}
    </section>
  )
}
