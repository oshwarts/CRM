import { useMemo, useState } from 'react'
import {
  CalendarDays,
  CheckSquare,
  Clock,
  MapPin,
  Pencil,
  Plus,
  Square,
  Trash2,
  User,
} from 'lucide-react'
import {
  useDeleteMeeting,
  useMeetings,
  useToggleMeetingTask,
} from '../lib/api'
import { MeetingFormModal } from '../components/MeetingFormModal'
import {
  ConfirmButton,
  EmptyState,
  ErrorState,
  Spinner,
} from '../components/ui'
import {
  MEETING_STATUS_LABELS,
  type MeetingWithRelations,
} from '../lib/types'
import { classNames, formatDate, formatTime, isOverdue } from '../lib/utils'

type FilterKey = 'all' | 'upcoming' | 'past' | 'followup'

export default function Meetings() {
  const meetings = useMeetings()
  const deleteMeeting = useDeleteMeeting()
  const toggleTask = useToggleMeetingTask()

  const [filter, setFilter] = useState<FilterKey>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<MeetingWithRelations | null>(null)

  const today = new Date().toISOString().slice(0, 10)

  const filtered = useMemo(() => {
    const list = meetings.data ?? []
    switch (filter) {
      case 'upcoming':
        return list.filter((m) => (m.meeting_date ?? '') >= today && m.status === 'scheduled')
      case 'past':
        return list.filter((m) => (m.meeting_date ?? '') < today || m.status === 'done')
      case 'followup':
        return list.filter(
          (m) => m.next_followup_date && m.status !== 'done' && m.status !== 'cancelled',
        )
      default:
        return list
    }
  }, [meetings.data, filter, today])

  const TABS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'הכל' },
    { key: 'upcoming', label: 'מתוכננות' },
    { key: 'past', label: 'עבר' },
    { key: 'followup', label: 'דורשות מעקב' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">פגישות</h1>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} />
          הוספת פגישה
        </button>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={classNames(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition',
              filter === t.key
                ? 'bg-white text-brand-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {meetings.isLoading && <Spinner />}
      {meetings.error && <ErrorState error={meetings.error} />}
      {meetings.data && filtered.length === 0 && (
        <EmptyState title="אין פגישות להצגה" />
      )}

      <div className="space-y-3">
        {filtered.map((m) => (
          <div key={m.id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800">
                  {m.subject || 'פגישה'}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
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
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="chip border-slate-200 bg-slate-50 text-slate-500">
                  {MEETING_STATUS_LABELS[m.status]}
                </span>
                <button
                  className="btn-ghost !px-2"
                  onClick={() => setEditing(m)}
                >
                  <Pencil size={15} />
                </button>
                <ConfirmButton
                  className="btn-ghost !px-2 text-red-500"
                  onConfirm={() => deleteMeeting.mutate(m.id)}
                >
                  <Trash2 size={15} />
                </ConfirmButton>
              </div>
            </div>

            {m.meeting_doctors.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {m.meeting_doctors.map(
                  (d) =>
                    d.doctor && (
                      <span
                        key={d.doctor.id}
                        className="chip border-brand-200 bg-brand-50 text-brand-700"
                      >
                        {d.doctor.title} {d.doctor.name}
                      </span>
                    ),
                )}
              </div>
            )}

            {m.summary && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                {m.summary}
              </p>
            )}

            {m.decisions && (
              <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm text-slate-600">
                <span className="font-medium">החלטות: </span>
                {m.decisions}
              </p>
            )}

            {m.meeting_tasks.length > 0 && (
              <ul className="mt-2 space-y-1">
                {m.meeting_tasks.map((t) => (
                  <li key={t.id}>
                    <button
                      className="flex items-center gap-2 text-sm text-slate-600"
                      onClick={() => toggleTask.mutate(t)}
                    >
                      {t.is_done ? (
                        <CheckSquare size={15} className="text-brand-500" />
                      ) : (
                        <Square size={15} className="text-slate-400" />
                      )}
                      <span className={t.is_done ? 'line-through text-slate-400' : ''}>
                        {t.description}
                        {t.due_date ? ` (${formatDate(t.due_date)})` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {m.next_followup_date && (
              <p
                className={classNames(
                  'mt-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm',
                  isOverdue(m.next_followup_date) && m.status !== 'done'
                    ? 'bg-red-50 text-red-600'
                    : 'bg-amber-50 text-amber-700',
                )}
              >
                <Clock size={14} />
                מעקב הבא: {formatDate(m.next_followup_date)}
              </p>
            )}
          </div>
        ))}
      </div>

      {showAdd && (
        <MeetingFormModal open={showAdd} onClose={() => setShowAdd(false)} />
      )}
      {editing && (
        <MeetingFormModal
          open={!!editing}
          meeting={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
