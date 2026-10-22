import { useMemo, useState } from 'react'
import { usePersisted } from '../lib/usePersisted'
import { useCanDelete } from '../lib/permissions'
import { PendingMark } from '../components/PendingMark'
import { usePendingRecords } from '../lib/outbox'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Building2,
  CheckSquare,
  ChevronDown,
  Clock,
  Mail,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Square,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import {
  useDeleteMeeting,
  useHospitals,
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
import { MeetingStatusChip } from '../components/MeetingBits'
import type { MeetingWithRelations } from '../lib/types'
import { classNames, formatDate, formatTime, isOverdue, todayISO } from '../lib/utils'
import { normalizeHe } from '../lib/contactMatch'
import { inTab, sortMeetings, type MeetingTab } from '../lib/meetingList'

type FilterKey = MeetingTab

/** cards drawn at a time: 300 cards with their tasks make the phone crawl */
const PAGE = 40

/** the date of a meeting as a small calendar tile: day and month, tinted when it is today or already past */
function DateTile({ date, status }: { date: string | null; status: string }) {
  if (!date) return <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-100 text-center text-xs leading-tight text-slate-500 sm:h-14 sm:w-14">ללא תאריך</span>
  const d = new Date(`${date}T12:00:00`)
  const today = todayISO()
  const tone = status === 'cancelled' ? 'bg-slate-100 text-slate-500' : date === today ? 'bg-brand-500 text-white' : date < today && status === 'scheduled' ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-700'
  return (
    <span className={classNames('flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl leading-tight sm:h-14 sm:w-14', tone)}>
      <span className="text-lg font-semibold sm:text-xl">{d.getDate()}</span>
      <span className="text-xs">
        {new Intl.DateTimeFormat('he-IL', { month: 'short' }).format(d)}
        {d.getFullYear() !== new Date().getFullYear() ? ` ${String(d.getFullYear()).slice(2)}` : ''}
      </span>
    </span>
  )
}

/** doctors in the meeting as one short line: names, and how many other people took part */
function peopleLine(m: MeetingWithRelations): string {
  const doctors = m.meeting_doctors.flatMap((d) => (d.doctor ? [`${d.doctor.title} ${d.doctor.name}`] : []))
  const others =
    m.meeting_agents.filter((a) => a.agent).length +
    m.meeting_contacts.filter((c) => c.contact).length +
    (m.extra_participants?.trim() ? 1 : 0)
  if (!doctors.length) return others ? `${others} משתתפים` : ''
  return doctors.join(', ') + (others ? ` +${others}` : '')
}

export default function Meetings() {
  const meetings = useMeetings()
  const deleteMeeting = useDeleteMeeting()
  const canDelete = useCanDelete()
  const toggleTask = useToggleMeetingTask()
  const hospitals = useHospitals()
  const pendingRecords = usePendingRecords()
  const pendingKey = [...pendingRecords.keys()].join(',') // a stable value for the memo below (the Map is new on every render)

  const [filter, setFilter] = usePersisted<FilterKey>('meetings.filter', 'all')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<MeetingWithRelations | null>(null)
  const [q, setQ] = usePersisted('meetings.q', '')
  const [params] = useSearchParams()
  const [hospitalId, setHospitalId] = useState(params.get('hospital') ?? '')
  const [doctorId, setDoctorId] = useState('')
  const [advanced, setAdvanced] = useState(!!params.get('hospital'))
  const [openTasks, setOpenTasks] = useState<Record<string, boolean>>({})
  const [from, setFrom] = usePersisted('meetings.from', '')
  const [to, setTo] = usePersisted('meetings.to', '')
  // how many cards are drawn; starts again from the first page when the filters change
  const [paging, setPaging] = useState({ key: '', n: PAGE })

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
    // a hospital opened from a link may have no meeting yet: it must still be a visible choice of the select
    if (hospitalId && !m.has(hospitalId)) m.set(hospitalId, (hospitals.data ?? []).find((h) => h.id === hospitalId)?.name ?? 'בית חולים')
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'he'))
  }, [meetings.data, hospitals.data, hospitalId])

  const filtered = useMemo(() => {
    const list = meetings.data ?? []
    let out = list.filter((m) => inTab(m, filter, today))

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

    return sortMeetings(out, filter, new Set(pendingKey ? pendingKey.split(',') : []))
  }, [meetings.data, filter, today, q, hospitalId, doctorId, from, to, pendingKey])


  const filterKey = [filter, q, hospitalId, doctorId, from, to].join('|')
  const shown = paging.key === filterKey ? paging.n : PAGE
  const hasSearch = !!(q || hospitalId || doctorId || from || to)
  const advancedCount = [hospitalId, doctorId, from, to].filter(Boolean).length

  const TABS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'הכל' },
    { key: 'upcoming', label: 'מתוכננות' },
    { key: 'past', label: 'עבר' },
    { key: 'followup', label: 'מעקב' },
  ]
  const tabCounts = useMemo(() => {
    const list = meetings.data ?? []
    const out: Record<FilterKey, number> = { all: 0, upcoming: 0, past: 0, followup: 0 }
    for (const k of Object.keys(out) as FilterKey[]) out[k] = list.filter((m) => inTab(m, k, today)).length
    return out
  }, [meetings.data, today])

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-brand-800 sm:text-3xl">פגישות</h1>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} />
          הוספת פגישה
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1 rounded-full bg-brand-50 p-1" role="group" aria-label="סוג פגישות">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            aria-pressed={filter === t.key}
            className={classNames(
              'flex min-h-10 items-center justify-center gap-1 rounded-full px-1 py-1.5 text-sm font-medium transition sm:px-4',
              filter === t.key
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-slate-600 hover:text-brand-700',
            )}
          >
            {t.label}
            {meetings.data && <span className="text-xs tabular-nums text-slate-500">{tabCounts[t.key]}</span>}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">חיפוש פגישות</span>
            <Search
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              className="input !pr-9"
              placeholder="חיפוש: נושא, רופא, מקום"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn-secondary relative shrink-0 !px-3 sm:hidden"
            onClick={() => setAdvanced((o) => !o)}
            aria-expanded={advanced}
            aria-label="סינון מתקדם"
          >
            <SlidersHorizontal size={16} />
            {advancedCount > 0 && (
              <span className="absolute -top-1 -end-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand-500 px-1 text-xs font-semibold text-white">
                {advancedCount}
              </span>
            )}
          </button>
        </div>
        <div className={classNames('card gap-3 p-3 sm:grid sm:grid-cols-2 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none lg:grid-cols-4', advanced ? 'grid grid-cols-2' : 'hidden')}>
          <label className="col-span-2 block sm:col-span-1">
            <span className="mb-0.5 block text-xs text-slate-600">בית חולים</span>
            <select className="input" value={hospitalId} onChange={(e) => setHospitalId(e.target.value)}>
              <option value="">כל בתי החולים</option>
              {hospitalOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2 block sm:col-span-1">
            <span className="mb-0.5 block text-xs text-slate-600">רופא</span>
            <select className="input" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              <option value="">כל הרופאים</option>
              {doctorOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0">
            <span className="mb-0.5 block text-xs text-slate-600">מתאריך</span>
            <input type="date" className="input" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="block min-w-0">
            <span className="mb-0.5 block text-xs text-slate-600">עד תאריך</span>
            <input type="date" className="input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
          <span aria-live="polite">
            {meetings.data ? `${filtered.length} פגישות${hasSearch ? ' תואמות לחיפוש' : ''}` : ' '}
          </span>
          {hasSearch && (
            <button
              className="inline-flex items-center gap-1 px-2 text-brand-700 hover:underline"
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

      {(deleteMeeting.error || toggleTask.error) && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {(() => {
            const e = deleteMeeting.error ?? toggleTask.error
            const why = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : ''
            return why || 'הפעולה נכשלה'
          })()}
        </p>
      )}

      {meetings.isLoading && <Spinner />}
      {meetings.error && !meetings.data && <ErrorState error={meetings.error} />}
      {meetings.error && meetings.data && (
        <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          לא הצלחנו לרענן — מוצגים הנתונים האחרונים שנשמרו.
        </p>
      )}
      {meetings.data && filtered.length === 0 && (
        <EmptyState
          title="אין פגישות להצגה"
          hint={hasSearch ? 'נסה לשנות או לנקות את החיפוש' : filter !== 'all' ? 'אין פגישות בלשונית הזו' : 'עוד לא נוספו פגישות. אפשר לתעד פגישה שהתקיימה או לתזמן את הבאה.'}
          action={
            !hasSearch ? (
              <button className="btn-primary" onClick={() => setShowAdd(true)}>
                <Plus size={16} /> הוספת פגישה
              </button>
            ) : undefined
          }
        />
      )}

      <ul className="grid gap-3 xl:grid-cols-2">
        {filtered.slice(0, shown).map((m) => {
          const people = peopleLine(m)
          const place = [m.location, m.responsible_agent?.full_name].filter(Boolean).join(' · ')
          const doneTasks = m.meeting_tasks.filter((t) => t.is_done).length
          const followupLate = !!m.next_followup_date && isOverdue(m.next_followup_date) && m.status !== 'done'
          const tasksOpen = !!openTasks[m.id]
          return (
            <li key={m.id} className="card relative p-3 transition hover:border-brand-300 sm:p-4">
              <div className="flex items-start gap-3">
                <DateTile date={m.meeting_date} status={m.status} />
                <div className="min-w-0 flex-1">
                  <h2 className="break-words text-base font-semibold leading-snug text-brand-800">
                    <span className="line-clamp-2" title={m.subject}>
                      <Link
                        to={`/meetings/${m.id}`}
                        className="!inline hover:text-brand-600 hover:underline after:absolute after:inset-0 after:rounded-2xl after:content-['']"
                      >
                        {m.subject || 'פגישה'}
                      </Link>
                    </span>
                    <PendingMark id={m.id} />
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
                    <MeetingStatusChip status={m.status} />
                    {m.status === 'scheduled' && !!m.meeting_date && m.meeting_date < today && (
                      <span className="chip border-red-200 bg-red-50 !px-2 !py-0.5 text-red-700">המועד עבר</span>
                    )}
                    {m.meeting_time && <span className="tabular-nums">{formatTime(m.meeting_time)}</span>}
                    {m.hospital && (
                      <span className="inline-flex min-w-0 items-center gap-1 font-medium">
                        <Building2 size={14} className="shrink-0" />
                        <span className="truncate">{m.hospital.name}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {(people || place) && (
                <div className="mt-2 space-y-0.5 text-sm text-slate-600">
                  {people && (
                    <p className="flex items-start gap-1.5" title={people}>
                      <Users size={14} className="mt-1 shrink-0 text-slate-500" />
                      <span className="line-clamp-1 break-words">{people}</span>
                    </p>
                  )}
                  {place && <p className="line-clamp-1 break-words ps-5 text-xs text-slate-500">{place}</p>}
                </div>
              )}

              {m.summary && <p className="mt-2 line-clamp-2 whitespace-pre-line break-words text-sm text-slate-700">{m.summary}</p>}
              {m.decisions && (
                <p className="mt-1.5 line-clamp-2 break-words text-sm text-slate-600">
                  <span className="font-semibold text-slate-700">החלטות: </span>
                  {m.decisions}
                </p>
              )}

              {tasksOpen && m.meeting_tasks.length > 0 && (
                <ul className="relative z-10 mt-2 space-y-0.5 rounded-xl bg-slate-50 p-1.5">
                  {m.meeting_tasks.map((t) => (
                    <li key={t.id}>
                      <button
                        className="flex w-full items-start gap-2 rounded-lg px-1.5 py-1 text-right text-sm text-slate-700 hover:bg-white"
                        onClick={() => toggleTask.mutate(t)}
                        aria-pressed={t.is_done}
                      >
                        {t.is_done ? (
                          <CheckSquare size={16} className="mt-0.5 shrink-0 text-brand-500" />
                        ) : (
                          <Square size={16} className="mt-0.5 shrink-0 text-slate-500" />
                        )}
                        <span className={classNames('min-w-0 break-words', t.is_done && 'text-slate-500 line-through')}>
                          {t.description}
                          {t.due_date ? ` (${formatDate(t.due_date)})` : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="relative z-10 mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                  {m.next_followup_date && (
                    <span
                      className={classNames(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                        followupLate ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800',
                      )}
                    >
                      <Clock size={13} />
                      מעקב {formatDate(m.next_followup_date)}
                    </span>
                  )}
                  {m.meeting_tasks.length > 0 && (
                    <button
                      type="button"
                      className="inline-flex min-h-10 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                      onClick={() => setOpenTasks((o) => ({ ...o, [m.id]: !o[m.id] }))}
                      aria-expanded={tasksOpen}
                    >
                      <CheckSquare size={13} />
                      משימות {doneTasks}/{m.meeting_tasks.length}
                      <ChevronDown size={13} className={classNames('transition', tasksOpen && 'rotate-180')} />
                    </button>
                  )}
                </div>
                <div className="flex shrink-0 items-center">
                  <Link
                    to={`/meetings/${m.id}?mail=1`}
                    className="btn-ghost !min-h-10 !min-w-10 !px-2"
                    title="שלח סיכום פגישה במייל"
                    aria-label="שלח סיכום פגישה במייל"
                  >
                    <Mail size={16} />
                  </Link>
                  <button className="btn-ghost !min-h-10 !min-w-10 !px-2" onClick={() => setEditing(m)} aria-label="עריכה" title="עריכה">
                    <Pencil size={16} />
                  </button>
                  {canDelete(m.created_by) && !pendingRecords.has(m.id) && (
                    <ConfirmButton
                      className="btn-ghost !min-h-10 !min-w-10 !px-2 text-red-600"
                      message={`למחוק את הפגישה "${m.subject || 'פגישה'}"?${m.meeting_tasks.length ? ` גם ${m.meeting_tasks.length} משימות של הפגישה יימחקו.` : ''} הפעולה אינה הפיכה.`}
                      onConfirm={() => deleteMeeting.mutate(m.id)}
                    >
                      <Trash2 size={16} />
                    </ConfirmButton>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {filtered.length > shown && (
        <div className="flex justify-center">
          <button className="btn-secondary" onClick={() => setPaging({ key: filterKey, n: shown + PAGE })}>
            הצג עוד ({filtered.length - shown})
          </button>
        </div>
      )}

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
