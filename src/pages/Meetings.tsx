import { useMemo, useState } from 'react'
import { usePersisted } from '../lib/usePersisted'
import { useCanDelete } from '../lib/permissions'
import { PendingMark } from '../components/PendingMark'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Building2,
  CalendarDays,
  CheckSquare,
  Clock,
  Mail,
  MapPin,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Square,
  Trash2,
  User,
  X,
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
import { classNames, formatDate, formatTime, isOverdue, todayISO } from '../lib/utils'
import { normalizeHe } from '../lib/contactMatch'

type FilterKey = 'all' | 'upcoming' | 'past' | 'followup'

/** the date of a meeting as a small calendar tile: day and month, tinted when it is today or already past */
function DateTile({ date, status }: { date: string | null; status: string }) {
  if (!date) return <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-slate-50 text-xs text-slate-400">ללא תאריך</span>
  const d = new Date(`${date}T12:00:00`)
  const today = todayISO()
  const tone = status === 'cancelled' ? 'bg-slate-100 text-slate-400' : date === today ? 'bg-brand-500 text-white' : date < today && status === 'scheduled' ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-700'
  return (
    <span className={classNames('flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl leading-tight', tone)}>
      <span className="text-xl font-semibold">{d.getDate()}</span>
      <span className="text-xs">{new Intl.DateTimeFormat('he-IL', { month: 'short' }).format(d)}</span>
    </span>
  )
}

export default function Meetings() {
  const meetings = useMeetings()
  const deleteMeeting = useDeleteMeeting()
  const canDelete = useCanDelete()
  const toggleTask = useToggleMeetingTask()

  const [filter, setFilter] = usePersisted<FilterKey>('meetings.filter', 'all')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<MeetingWithRelations | null>(null)
  const [q, setQ] = usePersisted('meetings.q', '')
  const [params] = useSearchParams()
  const [hospitalId, setHospitalId] = useState(params.get('hospital') ?? '')
  const [doctorId, setDoctorId] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const [from, setFrom] = usePersisted('meetings.from', '')
  const [to, setTo] = usePersisted('meetings.to', '')

  const today = todayISO() // local date: toISOString() is UTC, a day behind in Israel between midnight and 2-3 AM

  // doctors that appear in at least one meeting
  const doctorOptions = useMemo(() => {
    const m = new Map<string, string>()
    for (const mt of meetings.data ?? [])
      for (const md of mt.meeting_doctors)
        if (md.doctor) m.set(md.doctor.id, `${md.doctor.title} ${md.doctor.name}`)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'he'))
  }, [meetings.data])

  // hospitals that appear in at least one meeting
  const hospitalOptions = useMemo(() => {
    const m = new Map<string, string>()
    for (const mt of meetings.data ?? []) if (mt.hospital) m.set(mt.hospital.id, mt.hospital.name)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'he'))
  }, [meetings.data])

  const filtered = useMemo(() => {
    const list = meetings.data ?? []
    let out: MeetingWithRelations[]
    switch (filter) {
      case 'upcoming':
        out = list.filter((m) => (m.meeting_date ?? '') >= today && m.status === 'scheduled')
        break
      case 'past':
        out = list.filter((m) => (m.meeting_date ?? '') < today || m.status === 'done')
        break
      case 'followup':
        out = list.filter(
          (m) => m.next_followup_date && m.status !== 'done' && m.status !== 'cancelled',
        )
        break
      default:
        out = list
    }

    if (hospitalId) out = out.filter((m) => m.hospital_id === hospitalId)
    if (doctorId) out = out.filter((m) => m.meeting_doctors.some((d) => d.doctor?.id === doctorId))
    if (from) out = out.filter((m) => (m.meeting_date ?? '') >= from)
    if (to) out = out.filter((m) => m.meeting_date != null && m.meeting_date <= to)

    // free text: every word must appear somewhere in the meeting
    const words = normalizeHe(q).split(' ').filter(Boolean)
    if (words.length) {
      out = out.filter((m) => {
        const hay = normalizeHe(
          [
            m.subject,
            m.summary,
            m.decisions,
            m.location,
            m.hospital?.name,
            m.extra_participants,
            ...m.meeting_agents.map((a) => a.agent?.full_name),
            ...m.meeting_contacts.map((c) => c.contact?.name),
            m.responsible_agent?.full_name,
            ...m.meeting_doctors.map((d) => (d.doctor ? `${d.doctor.title} ${d.doctor.name}` : '')),
            ...m.meeting_tasks.map((t) => t.description),
          ]
            .filter(Boolean)
            .join(' '),
        )
        return words.every((w) => hay.includes(w))
      })
    }

    // newest meeting first by default; meetings without a date go last
    const dir = -1
    return [...out].sort((a, b) => {
      if (!a.meeting_date && !b.meeting_date) return 0
      if (!a.meeting_date) return 1
      if (!b.meeting_date) return -1
      return (
        dir *
        (a.meeting_date.localeCompare(b.meeting_date) ||
          (a.meeting_time ?? '').localeCompare(b.meeting_time ?? '') ||
          a.created_at.localeCompare(b.created_at))
      )
    })
  }, [meetings.data, filter, today, q, hospitalId, doctorId, from, to])

  const hasSearch = !!(q || hospitalId || doctorId || from || to)

  const TABS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'הכל' },
    { key: 'upcoming', label: 'מתוכננות' },
    { key: 'past', label: 'עבר' },
    { key: 'followup', label: 'דורשות מעקב' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand-800 sm:text-3xl">פגישות</h1>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} />
          הוספת פגישה
        </button>
      </div>

      <div className="flex flex-wrap gap-1 rounded-full bg-brand-50 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={classNames(
              'rounded-full px-4 py-1.5 text-sm font-medium transition',
              filter === t.key
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-slate-600 hover:text-brand-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card space-y-3 p-4">
        <label className="relative block">
          <Search
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            className="input !pr-9"
            placeholder="חיפוש: נושא, סיכום, מקום"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <button type="button" className="btn-secondary sm:hidden" onClick={() => setAdvanced((o) => !o)} aria-expanded={advanced}>
          <SlidersHorizontal size={16} /> סינון מתקדם
        </button>
        <div className={classNames("gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4", advanced ? "grid" : "hidden")}>
          <select className="input" aria-label="בית חולים" value={hospitalId} onChange={(e) => setHospitalId(e.target.value)}>
            <option value="">כל בתי החולים</option>
            {hospitalOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select className="input" aria-label="רופא" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            <option value="">כל הרופאים</option>
            {doctorOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <label className="block">
            <span className="mb-0.5 block text-xs text-slate-500">מתאריך</span>
            <input type="date" className="input" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-xs text-slate-500">עד תאריך</span>
            <input type="date" className="input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
          <span>
            {meetings.data ? `${filtered.length} פגישות${hasSearch ? ' תואמות לחיפוש' : ''}` : ' '}
          </span>
          {hasSearch && (
            <button
              className="inline-flex items-center gap-1 text-brand-600 hover:underline"
              onClick={() => {
                setQ('')
                setHospitalId('')
                setDoctorId('')
                setFrom('')
                setTo('')
              }}
            >
              <X size={14} />
              נקה חיפוש
            </button>
          )}
        </div>
      </div>

      {meetings.isLoading && <Spinner />}
      {meetings.error && <ErrorState error={meetings.error} />}
      {meetings.data && filtered.length === 0 && (
        <EmptyState
          title="אין פגישות להצגה"
          hint={hasSearch ? 'נסה לשנות או לנקות את החיפוש' : undefined}
          action={
            !hasSearch ? (
              <button className="btn-primary" onClick={() => setShowAdd(true)}>
                <Plus size={16} /> הוספת פגישה
              </button>
            ) : undefined
          }
        />
      )}

      <div className="space-y-3">
        {filtered.map((m) => (
          <div key={m.id} className="card p-4 transition hover:border-brand-300">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <DateTile date={m.meeting_date} status={m.status} />
                <div className="min-w-0">
                <Link
                  to={`/meetings/${m.id}`}
                  className="break-words text-base font-semibold text-brand-800 hover:text-brand-600 hover:underline"
                >
                  {m.subject || 'פגישה'} <PendingMark id={m.id} />
                </Link>
                <div className="mt-1 flex flex-col gap-y-1 text-sm text-slate-500 sm:flex-row sm:flex-wrap sm:gap-x-4">
                  {m.meeting_date && (
                    <span className="inline-flex items-start gap-1">
                      <CalendarDays size={14} className="mt-1 shrink-0" />
                      {formatDate(m.meeting_date)}
                      {m.meeting_time ? ` · ${formatTime(m.meeting_time)}` : ''}
                    </span>
                  )}
                  {m.location && (
                    <span className="inline-flex items-start gap-1 break-words">
                      <MapPin size={14} className="mt-1 shrink-0" />
                      {m.location}
                    </span>
                  )}
                  {m.responsible_agent?.full_name && (
                    <span className="inline-flex items-start gap-1">
                      <User size={14} className="mt-1 shrink-0" />
                      {m.responsible_agent.full_name}
                    </span>
                  )}
                </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
                <span className="chip border-slate-200 bg-slate-50 text-slate-600">
                  {MEETING_STATUS_LABELS[m.status]}
                </span>
                <div className="flex items-center gap-1 [margin-inline-start:auto] lg:[margin-inline-start:0]">
                  <Link
                    to={`/meetings/${m.id}?mail=1`}
                    className="btn-secondary !px-3 !py-1.5 text-xs"
                    title="שלח סיכום פגישה במייל"
                    aria-label="שלח סיכום פגישה במייל"
                  >
                    <Mail size={14} />
                    <span className="hidden sm:inline">שלח סיכום במייל</span>
                  </Link>
                  <button
                    className="btn-ghost !px-2"
                    onClick={() => setEditing(m)}
                    aria-label="עריכה"
                  >
                    <Pencil size={15} />
                  </button>
                  {canDelete(m.created_by) && (
                    <ConfirmButton
                      className="btn-ghost !px-2 text-red-500"
                      onConfirm={() => deleteMeeting.mutate(m.id)}
                    >
                      <Trash2 size={15} />
                    </ConfirmButton>
                  )}
                </div>
              </div>
            </div>

            {m.hospital && (
              <p className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-slate-600">
                <Building2 size={14} />
                {m.hospital.name}
              </p>
            )}

            {(m.meeting_doctors.length > 0 || m.meeting_contacts.length > 0 || m.meeting_agents.length > 0) && (
              <div className="mt-2 flex flex-wrap gap-1">
                {m.meeting_doctors.map(
                  (d) =>
                    d.doctor && (
                      <Link
                        key={d.doctor.id}
                        to={`/doctors/${d.doctor.id}`}
                        className="chip border-brand-200 bg-brand-50 text-brand-700 transition hover:bg-brand-100"
                        title="פתח את כרטיס הרופא"
                      >
                        {d.doctor.title} {d.doctor.name}
                      </Link>
                    ),
                )}
                {m.meeting_agents.map(
                  (a) =>
                    a.agent && (
                      <span
                        key={a.agent.id}
                        className="chip border-slate-300 bg-slate-100 text-slate-700"
                      >
                        {a.agent.full_name}
                        {a.agent.role === 'admin' ? ' (מנהל)' : ''}
                      </span>
                    ),
                )}
                {m.meeting_contacts.map(
                  (c) =>
                    c.contact && (
                      <span
                        key={c.contact.id}
                        className="chip border-emerald-200 bg-emerald-50 text-emerald-700"
                      >
                        {c.contact.name}
                        {c.contact.role ? ` · ${c.contact.role}` : ''}
                      </span>
                    ),
                )}
              </div>
            )}

            {m.extra_participants && (
              <p className="mt-2 text-sm text-slate-500">
                <span className="font-medium">משתתפים נוספים: </span>
                {m.extra_participants}
              </p>
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
