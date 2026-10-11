import { CalendarDays, CheckSquare, Clock, MapPin, Pencil, Square, User } from 'lucide-react'
import { useToggleMeetingTask } from '../lib/api'
import { MEETING_STATUS_LABELS, type MeetingWithRelations } from '../lib/types'
import { classNames, formatDate, formatTime, isOverdue } from '../lib/utils'
import { Modal } from './ui'

/** read-only view of one meeting: summary, decisions, tasks */
export function MeetingDetailModal({
  meeting: m,
  onClose,
  onEdit,
}: {
  meeting: MeetingWithRelations
  onClose: () => void
  onEdit: () => void
}) {
  const toggleTask = useToggleMeetingTask()

  return (
    <Modal open onClose={onClose} title={m.subject || 'פגישה'} size="lg">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
          {m.meeting_date && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={14} />
              {formatDate(m.meeting_date)}
              {m.meeting_time ? ` · ${formatTime(m.meeting_time)}` : ''}
            </span>
          )}
          {m.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={14} />
              {m.location}
            </span>
          )}
          {m.responsible_agent?.full_name && (
            <span className="inline-flex items-center gap-1">
              <User size={14} />
              {m.responsible_agent.full_name}
            </span>
          )}
          <span className="chip border-slate-200 bg-slate-50 text-slate-500">
            {MEETING_STATUS_LABELS[m.status]}
          </span>
        </div>

        {m.meeting_doctors.some((d) => d.doctor) && (
          <div className="flex flex-wrap gap-1">
            {m.meeting_doctors.map(
              (d) =>
                d.doctor && (
                  <span key={d.doctor.id} className="chip border-brand-200 bg-brand-50 text-brand-700">
                    {d.doctor.title} {d.doctor.name}
                  </span>
                ),
            )}
          </div>
        )}

        <section>
          <h3 className="mb-1 text-sm font-semibold text-slate-700">סיכום</h3>
          {m.summary ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{m.summary}</p>
          ) : (
            <p className="text-sm text-slate-400">לא נרשם סיכום.</p>
          )}
        </section>

        {m.decisions && (
          <section>
            <h3 className="mb-1 text-sm font-semibold text-slate-700">החלטות</h3>
            <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
              {m.decisions}
            </p>
          </section>
        )}

        {m.meeting_tasks.length > 0 && (
          <section>
            <h3 className="mb-1 text-sm font-semibold text-slate-700">משימות להמשך</h3>
            <ul className="space-y-1.5">
              {m.meeting_tasks.map((t) => (
                <li key={t.id}>
                  <button
                    className="flex items-start gap-2 text-right text-sm text-slate-700"
                    onClick={() => toggleTask.mutate(t)}
                  >
                    {t.is_done ? (
                      <CheckSquare size={16} className="mt-0.5 shrink-0 text-brand-500" />
                    ) : (
                      <Square size={16} className="mt-0.5 shrink-0 text-slate-400" />
                    )}
                    <span className={t.is_done ? 'text-slate-400 line-through' : ''}>
                      {t.description}
                      {t.due_date ? ` (${formatDate(t.due_date)})` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {m.next_followup_date && (
          <p
            className={classNames(
              'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm',
              isOverdue(m.next_followup_date) && m.status !== 'done'
                ? 'bg-red-50 text-red-600'
                : 'bg-amber-50 text-amber-700',
            )}
          >
            <Clock size={14} />
            מעקב הבא: {formatDate(m.next_followup_date)}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <button className="btn-secondary" onClick={onClose}>
            סגירה
          </button>
          <button className="btn-primary" onClick={onEdit}>
            <Pencil size={15} />
            עריכה
          </button>
        </div>
      </div>
    </Modal>
  )
}
