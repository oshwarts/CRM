import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  CalendarDays,
  Clock,
  Heart,
  ScanLine,
  Stethoscope,
  Target,
  X,
} from 'lucide-react'
import {
  useDoctors,
  useFavorites,
  useMeetings,
  usePatientScans,
  useToggleFavorite,
} from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import { EmptyState, Spinner } from '../components/ui'
import { MeetingFormModal } from '../components/MeetingFormModal'
import {
  classNames,
  daysUntil,
  formatDate,
  isOverdue,
  plusDaysISO,
  todayISO,
} from '../lib/utils'

type SurgeryRange = '7' | '14' | '30' | 'date'
const RANGE_KEY = 'ami.home.surgeryRange'

function loadRange(): { range: SurgeryRange; until: string } {
  try {
    const raw = JSON.parse(localStorage.getItem(RANGE_KEY) ?? 'null')
    if (raw && ['7', '14', '30', 'date'].includes(raw.range))
      return { range: raw.range, until: typeof raw.until === 'string' ? raw.until : '' }
  } catch {
    // storage unavailable — use the default
  }
  return { range: '7', until: '' }
}
import { rescanAlert, weekMissing, type RescanKind } from '../lib/scanAlerts'

const RESCAN_LABEL: Record<RescanKind, string> = {
  today: 'היום',
  soon: '',
  overdue: 'באיחור',
  nodate: 'ללא תאריך',
}

export default function Home() {
  const { user, profile } = useAuth()
  const doctors = useDoctors()
  const favorites = useFavorites()
  const meetings = useMeetings()
  const scans = usePatientScans()
  const toggleFav = useToggleFavorite()
  const [toAdd, setToAdd] = useState('')
  const [surgeryRange, setSurgeryRange] = useState(loadRange)
  const [scheduleFor, setScheduleFor] = useState<string | null>(null)

  function changeRange(next: { range: SurgeryRange; until: string }) {
    setSurgeryRange(next)
    try {
      localStorage.setItem(RANGE_KEY, JSON.stringify(next))
    } catch {
      // not critical
    }
  }

  // surgeries up to this date are listed under "לקראת ניתוח" (a week by default)
  const surgeryUntil =
    surgeryRange.range === 'date'
      ? surgeryRange.until || plusDaysISO(7)
      : plusDaysISO(Number(surgeryRange.range))

  const scanAlerts = useMemo(() => {
    const t = todayISO()
    const list = scans.data ?? []
    const active = list.filter((s) => s.status !== 'cancelled')
    const surgerySoon = (s: (typeof list)[number]) =>
      !!s.surgery_date && s.surgery_date >= t && s.surgery_date <= surgeryUntil
    return {
      upcoming: list.filter(
        (s) => s.ct_date && s.ct_date >= t && (daysUntil(s.ct_date) ?? 99) <= 7 && !s.scanned,
      ),
      overdue: list.filter(
        (s) => s.ct_date && s.ct_date < t && !s.scanned && s.status !== 'cancelled',
      ),
      // ניתוח בשבוע הקרוב, ועדיין אין תאריך CT מתואם
      noCtSoon: active.filter((s) => surgerySoon(s) && !s.ct_date),
      // ניתוח בשבוע הקרוב, יש CT אבל הדיסק טרם נאסף
      noDiskSoon: active.filter(
        (s) => surgerySoon(s) && !!s.ct_date && !s.disk_collected,
      ),
      // CT בשבוע הקרוב שעדיין חסר בו משהו (לא בוצע / דיסק / תוכנית)
      weekOpen: list
        .map((s) => ({ s, missing: weekMissing(s) }))
        .filter((x) => x.missing.length > 0)
        .sort((a, b) => (a.s.ct_date ?? '').localeCompare(b.s.ct_date ?? '')),
      // סריקות חוזרות פתוחות — לוודא שהסוכן מגיע
      rescans: list
        .map((s) => ({ s, kind: rescanAlert(s) }))
        .filter((x): x is { s: (typeof list)[number]; kind: RescanKind } => x.kind !== null)
        .sort((a, b) => (a.s.rescan_date ?? '').localeCompare(b.s.rescan_date ?? '')),
    }
  }, [scans.data, surgeryUntil])

  const favIds = favorites.data ?? []
  const favSet = new Set(favIds)
  const allDoctors = doctors.data ?? []
  const favDoctors = allDoctors.filter((d) => favSet.has(d.id))
  const potentialDoctors = allDoctors.filter((d) => d.status === 'potential')

  // per doctor: last meeting that took place, the next scheduled meeting, and the follow-up date
  // recorded on the latest meeting
  const meetingInfoByDoctor = useMemo(() => {
    type Info = { last?: string; next?: string; followup?: string; followupFrom?: string }
    const map = new Map<string, Info>()
    const today = todayISO()
    for (const m of meetings.data ?? []) {
      if (!m.meeting_date || m.status === 'cancelled') continue
      const upcoming = m.meeting_date >= today && m.status !== 'done'
      for (const md of m.meeting_doctors) {
        if (!md.doctor) continue
        const cur = map.get(md.doctor.id) ?? {}
        if (upcoming) {
          if (!cur.next || m.meeting_date < cur.next) cur.next = m.meeting_date
        } else if (!cur.last || m.meeting_date > cur.last) {
          cur.last = m.meeting_date
          cur.followupFrom = m.meeting_date
          cur.followup = m.next_followup_date ?? undefined
        }
        map.set(md.doctor.id, cur)
      }
    }
    return map
  }, [meetings.data])

  // follow-up of the favorite doctors: overdue → not scheduled yet → coming up → later
  const favFollow = useMemo(() => {
    const t = todayISO()
    const rank = { overdue: 0, none: 1, soon: 2, later: 3 } as const
    return favDoctors
      .map((d) => {
        const info = meetingInfoByDoctor.get(d.id)
        const nextDate = info?.next ?? info?.followup
        const status: keyof typeof rank = !nextDate
          ? 'none'
          : nextDate < t
            ? 'overdue'
            : (daysUntil(nextDate) ?? 99) <= 7
              ? 'soon'
              : 'later'
        return { d, info, nextDate, isFollowup: !info?.next && !!info?.followup, status }
      })
      .sort(
        (a, b) =>
          rank[a.status] - rank[b.status] ||
          // among the unscheduled, the one not met for the longest time comes first
          (a.status === 'none' ? (a.info?.last ?? '').localeCompare(b.info?.last ?? '') : (a.nextDate ?? '').localeCompare(b.nextDate ?? '')),
      )
  }, [favDoctors, meetingInfoByDoctor])

  const followups = useMemo(() => {
    return (meetings.data ?? [])
      .filter(
        (m) =>
          m.next_followup_date &&
          m.status !== 'done' &&
          m.status !== 'cancelled' &&
          (!m.responsible_agent_id ||
            m.responsible_agent_id === user?.id ||
            m.meeting_agents.some((a) => a.agent?.id === user?.id)),
      )
      .sort((a, b) =>
        (a.next_followup_date ?? '').localeCompare(b.next_followup_date ?? ''),
      )
  }, [meetings.data, user?.id])

  // reminders: scheduled meetings in the coming week, and ones whose date passed without being closed
  const reminders = useMemo(() => {
    const t = todayISO()
    const weekEnd = plusDaysISO(7)
    const open = (meetings.data ?? []).filter(
      (m) =>
        m.meeting_date &&
        m.status === 'scheduled' &&
        (!m.responsible_agent_id ||
          m.responsible_agent_id === user?.id ||
          m.meeting_agents.some((a) => a.agent?.id === user?.id)),
    )
    return {
      soon: open
        .filter((m) => m.meeting_date! >= t && m.meeting_date! <= weekEnd)
        .sort((a, b) => a.meeting_date!.localeCompare(b.meeting_date!)),
      missed: open
        .filter((m) => m.meeting_date! < t)
        .sort((a, b) => a.meeting_date!.localeCompare(b.meeting_date!)),
    }
  }, [meetings.data, user?.id])

  const reminderRow = (m: (typeof reminders.soon)[number], chip: string, chipClass: string) => (
    <li key={m.id}>
      <Link
        to={`/meetings/${m.id}`}
        className="flex items-center justify-between gap-3 rounded-lg px-1 py-2 hover:bg-slate-50"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-700">{m.subject || 'פגישה'}</p>
          <p className="truncate text-xs text-slate-400">
            {[
              m.meeting_doctors
                .map((d) => d.doctor && `${d.doctor.title} ${d.doctor.name}`)
                .filter(Boolean)
                .join(', '),
              m.hospital?.name,
            ]
              .filter(Boolean)
              .join(' · ') || '—'}
          </p>
        </div>
        <span className={classNames('chip shrink-0', chipClass)}>{chip}</span>
      </Link>
    </li>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          שלום{profile?.full_name ? `, ${profile.full_name}` : ''}
        </h1>
        <p className="text-sm text-slate-400">
          הרופאים המועדפים שלך ומעקב הפגישות במקום אחד
        </p>
      </div>

      {/* follow-ups */}
      <section className="card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
          <Clock size={18} className="text-brand-500" />
          מעקב פגישות
        </h2>
        {meetings.isLoading ? (
          <Spinner />
        ) : followups.length === 0 && reminders.soon.length === 0 && reminders.missed.length === 0 && favFollow.length === 0 ? (
          <p className="text-sm text-slate-400">אין פגישות השבוע ואין פגישות שממתינות למעקב.</p>
        ) : (
          <>
            {favFollow.length > 0 && (
              <div className="mb-4 rounded-xl border border-slate-200 p-3">
                <p className="mb-1 text-sm font-semibold text-slate-700">
                  מעקב רופאים מועדפים ({favFollow.length})
                </p>
                <ul className="divide-y divide-slate-100">
                  {favFollow.map(({ d, info, nextDate, isFollowup, status }) => {
                    const since = info?.last ? -(daysUntil(info.last) ?? 0) : null
                    const chip =
                      status === 'none'
                        ? 'לא תואמה פגישה הבאה'
                        : `${isFollowup ? 'מעקב' : 'פגישה'}: ${formatDate(nextDate)}${status === 'overdue' ? ' · באיחור' : ''}`
                    const chipClass = {
                      overdue: 'border-red-200 bg-red-50 text-red-600',
                      none: 'border-amber-200 bg-amber-50 text-amber-700',
                      soon: 'border-sky-200 bg-sky-50 text-sky-700',
                      later: 'border-slate-200 bg-white text-slate-500',
                    }[status]
                    return (
                      <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <Link to={`/doctors/${d.id}`} className="min-w-0 flex-1 hover:underline">
                          <p className="truncate text-sm font-medium text-slate-700">
                            {d.title} {d.name}
                          </p>
                          <p className="truncate text-xs text-slate-400">
                            {info?.last
                              ? `פגישה אחרונה ${formatDate(info.last)}${since ? ` (לפני ${since} ימים)` : ''}`
                              : 'עדיין לא התקיימו פגישות'}
                          </p>
                        </Link>
                        <span className={classNames('chip shrink-0', chipClass)}>{chip}</span>
                        {(status === 'none' || status === 'overdue') && (
                          <button className="btn-secondary !px-3 !py-1 text-xs" onClick={() => setScheduleFor(d.id)}>
                            קבע פגישה
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            {reminders.missed.length > 0 && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50/60 p-3">
                <p className="mb-1 text-sm font-semibold text-red-700">
                  עבר מועד הפגישה ({reminders.missed.length}) — עדכן סיכום וסטטוס או קבע מועד חדש
                </p>
                <ul className="divide-y divide-red-100">
                  {reminders.missed.map((m) =>
                    reminderRow(m, `${formatDate(m.meeting_date)} · עבר`, 'border-red-200 bg-white text-red-600'),
                  )}
                </ul>
              </div>
            )}
            {reminders.soon.length > 0 && (
              <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50/60 p-3">
                <p className="mb-1 text-sm font-semibold text-sky-800">
                  פגישות בשבוע הקרוב ({reminders.soon.length})
                </p>
                <ul className="divide-y divide-sky-100">
                  {reminders.soon.map((m) => {
                    const d = daysUntil(m.meeting_date) ?? 0
                    const when = d === 0 ? 'היום' : d === 1 ? 'מחר' : `בעוד ${d} ימים`
                    return reminderRow(m, `${when} · ${formatDate(m.meeting_date)}`, 'border-sky-200 bg-white text-sky-700')
                  })}
                </ul>
              </div>
            )}
            {followups.length > 0 && (
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                תאריכי מעקב
              </p>
            )}
          <ul className="divide-y divide-slate-100">
            {followups.map((m) => {
              const overdue = isOverdue(m.next_followup_date)
              return (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-700">
                      {m.subject || 'פגישה'}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {m.meeting_doctors
                        .map((d) => d.doctor && `${d.doctor.title} ${d.doctor.name}`)
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </p>
                  </div>
                  <span
                    className={classNames(
                      'chip shrink-0',
                      overdue
                        ? 'border-red-200 bg-red-50 text-red-600'
                        : 'border-amber-200 bg-amber-50 text-amber-700',
                    )}
                  >
                    {overdue ? 'באיחור · ' : ''}
                    {formatDate(m.next_followup_date)}
                  </span>
                </li>
              )
            })}
          </ul>
          </>
        )}
      </section>

      {scheduleFor && (
        <MeetingFormModal open onClose={() => setScheduleFor(null)} defaultDoctorId={scheduleFor} />
      )}

      {/* MAKO scans */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-slate-800">
            <ScanLine size={18} className="text-brand-500" />
            סריקות MAKO
          </h2>
          <Link to="/scans" className="text-sm font-medium text-brand-600 hover:underline">
            לכל הסריקות →
          </Link>
        </div>
        {scans.isLoading ? (
          <Spinner />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Link to="/scans" className="rounded-lg bg-slate-50 p-3 text-center hover:bg-slate-100">
                <p className="text-2xl font-bold text-slate-800">{scans.data?.length ?? 0}</p>
                <p className="text-xs text-slate-400">סה״כ מטופלים</p>
              </Link>
              <Link
                to="/scans"
                className={classNames(
                  'rounded-lg p-3 text-center',
                  scanAlerts.upcoming.length ? 'bg-amber-50 hover:bg-amber-100' : 'bg-slate-50',
                )}
              >
                <p className="text-2xl font-bold text-amber-600">{scanAlerts.upcoming.length}</p>
                <p className="text-xs text-slate-400">CT בשבוע הקרוב</p>
              </Link>
              <Link
                to="/scans"
                className={classNames(
                  'rounded-lg p-3 text-center',
                  scanAlerts.overdue.length ? 'bg-red-50 hover:bg-red-100' : 'bg-slate-50',
                )}
              >
                <p className="text-2xl font-bold text-red-600">{scanAlerts.overdue.length}</p>
                <p className="text-xs text-slate-400">CT עבר — טרם נסרק</p>
              </Link>
            </div>

            <div className="mb-2 mt-4 flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                לקראת ניתוח — עד
              </p>
              <select
                className="input !w-auto !py-1 text-sm"
                value={surgeryRange.range}
                onChange={(e) =>
                  changeRange({
                    range: e.target.value as SurgeryRange,
                    until: surgeryRange.until || plusDaysISO(7),
                  })
                }
              >
                <option value="7">שבוע</option>
                <option value="14">שבועיים</option>
                <option value="30">חודש</option>
                <option value="date">תאריך מסוים…</option>
              </select>
              {surgeryRange.range === 'date' && (
                <input
                  type="date"
                  className="input !w-auto !py-1 text-sm"
                  min={todayISO()}
                  value={surgeryRange.until}
                  onChange={(e) => changeRange({ range: 'date', until: e.target.value })}
                />
              )}
              <span className="text-xs text-slate-400">(עד {formatDate(surgeryUntil)})</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                to="/scans"
                className={classNames(
                  'rounded-lg p-3 text-center',
                  scanAlerts.noCtSoon.length ? 'bg-fuchsia-50 hover:bg-fuchsia-100' : 'bg-slate-50',
                )}
              >
                <p className="text-2xl font-bold text-fuchsia-600">{scanAlerts.noCtSoon.length}</p>
                <p className="text-xs text-slate-400">ניתוח עד התאריך — אין תאריך CT מתואם</p>
              </Link>
              <Link
                to="/scans"
                className={classNames(
                  'rounded-lg p-3 text-center',
                  scanAlerts.noDiskSoon.length ? 'bg-orange-50 hover:bg-orange-100' : 'bg-slate-50',
                )}
              >
                <p className="text-2xl font-bold text-orange-600">{scanAlerts.noDiskSoon.length}</p>
                <p className="text-xs text-slate-400">ניתוח עד התאריך — הדיסק לא נאסף</p>
              </Link>
            </div>
          </>
        )}
        {scanAlerts.upcoming.length > 0 && (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {scanAlerts.upcoming.slice(0, 5).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-1.5">
                <span className="text-slate-700">
                  {s.patient_name}
                  <span className="mr-2 text-xs text-slate-400">
                    {s.hospital?.name}
                  </span>
                </span>
                <span className="chip border-amber-200 bg-amber-50 text-amber-700">
                  CT {formatDate(s.ct_date)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {scanAlerts.noCtSoon.length > 0 && (
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {scanAlerts.noCtSoon.slice(0, 10).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-1.5">
                <span className="text-slate-700">
                  {s.patient_name}
                  <span className="mr-2 text-xs text-slate-400">{s.hospital?.name}</span>
                </span>
                <span className="chip border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700">
                  ניתוח {formatDate(s.surgery_date)} · אין CT
                </span>
              </li>
            ))}
          </ul>
        )}
        {scanAlerts.noDiskSoon.length > 0 && (
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {scanAlerts.noDiskSoon.slice(0, 10).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-1.5">
                <span className="text-slate-700">
                  {s.patient_name}
                  <span className="mr-2 text-xs text-slate-400">{s.hospital?.name}</span>
                </span>
                <span className="chip border-orange-200 bg-orange-50 text-orange-700">
                  ניתוח {formatDate(s.surgery_date)} · דיסק לא נאסף
                </span>
              </li>
            ))}
          </ul>
        )}
        {scanAlerts.weekOpen.length > 0 && (
          <>
            <p className="mb-1 mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">
              CT בשבוע הקרוב — חסר טיפול ({scanAlerts.weekOpen.length})
            </p>
            <ul className="divide-y divide-slate-100 text-sm">
              {scanAlerts.weekOpen.slice(0, 8).map(({ s, missing }) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                  <span className="text-slate-700">
                    {s.patient_name}
                    <span className="mr-2 text-xs text-slate-400">
                      {s.hospital?.name} · CT {formatDate(s.ct_date)}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {missing.map((m) => (
                      <span key={m} className="chip border-sky-200 bg-sky-50 text-sky-700">{m}</span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        {scanAlerts.rescans.length > 0 && (
          <>
            <p className="mb-1 mt-4 text-xs font-medium uppercase tracking-wide text-rose-500">
              סריקה חוזרת — לוודא שהסוכן מגיע ({scanAlerts.rescans.length})
            </p>
            <ul className="divide-y divide-slate-100 text-sm">
              {scanAlerts.rescans.map(({ s, kind }) => (
                <li
                  key={s.id}
                  className={classNames(
                    'flex flex-wrap items-center justify-between gap-2 rounded px-1 py-1.5',
                    (kind === 'today' || kind === 'overdue') && 'bg-rose-50',
                  )}
                >
                  <span className="text-slate-700">
                    {s.patient_name}
                    <span className="mr-2 text-xs text-slate-400">
                      {s.hospital?.name}
                      {s.rescan_reason ? ` · ${s.rescan_reason}` : ''}
                    </span>
                  </span>
                  <span className="chip border-rose-200 bg-rose-50 text-rose-700">
                    {s.rescan_date ? formatDate(s.rescan_date) : ''}
                    {RESCAN_LABEL[kind] && ` · ${RESCAN_LABEL[kind]}`}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* potential doctors */}
      {potentialDoctors.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
            <Target size={18} className="text-amber-500" />
            רופאים פוטנציאליים במעקב ({potentialDoctors.length})
          </h2>
          <ul className="divide-y divide-slate-100">
            {potentialDoctors.map((d) => (
              <li key={d.id} className="py-2">
                <Link
                  to={`/doctors/${d.id}`}
                  className="block rounded-lg px-2 py-1 hover:bg-slate-50"
                >
                  <p className="text-sm font-medium text-slate-700">
                    {d.title} {d.name}
                    <span className="mr-2 text-xs font-normal text-slate-400">
                      {d.doctor_hospitals
                        .map((h) => h.hospital?.name)
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </p>
                  {d.tracking_notes && (
                    <p className="truncate text-xs text-slate-500">
                      {d.tracking_notes}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* favorites picker */}
      <section className="card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
          <Heart size={18} className="text-red-500" />
          רופאים מועדפים
        </h2>
        <div className="flex flex-wrap gap-2">
          <select
            className="input max-w-xs"
            value={toAdd}
            onChange={(e) => {
              const id = e.target.value
              setToAdd('')
              if (id && !favSet.has(id))
                toggleFav.mutate({ doctorId: id, isFavorite: false })
            }}
          >
            <option value="">בחר רופא להוספה למועדפים…</option>
            {allDoctors
              .filter((d) => !favSet.has(d.id))
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} {d.name}
                </option>
              ))}
          </select>
        </div>

        {favDoctors.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {favDoctors.map((d) => (
              <span
                key={d.id}
                className="chip border-red-200 bg-red-50 text-red-600"
              >
                {d.title} {d.name}
                <button
                  onClick={() =>
                    toggleFav.mutate({ doctorId: d.id, isFavorite: true })
                  }
                  aria-label="הסר"
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* favorite doctor cards */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
          <Stethoscope size={18} className="text-brand-500" />
          הרופאים המועדפים שלי
        </h2>

        {favorites.isLoading || doctors.isLoading ? (
          <Spinner />
        ) : favDoctors.length === 0 ? (
          <EmptyState
            title="עדיין לא סימנת רופאים מועדפים"
            hint="בחר רופאים מהרשימה למעלה כדי לראות אותם כאן"
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {favDoctors.map((d) => {
              const info = meetingInfoByDoctor.get(d.id)
              const nextDate = info?.next ?? info?.followup
              const nextIsFollowup = !info?.next && !!info?.followup
              const sinceLast = info?.last ? -(daysUntil(info.last) ?? 0) : null
              return (
                <Link
                  key={d.id}
                  to={`/doctors/${d.id}`}
                  className="card flex flex-col gap-3 p-4 hover:border-brand-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-500 text-white">
                      <Stethoscope size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800">
                        {d.title} {d.name}
                      </p>
                      <p className="truncate text-sm text-slate-500">
                        {d.position || '—'}
                      </p>
                      {(d.phone || d.email) && (
                        <p className="truncate text-xs text-slate-400" dir="ltr">
                          {[d.phone, d.email].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <p className={info?.last ? 'text-slate-600' : 'text-slate-400'}>
                      <Clock size={13} className="ml-1 inline" />
                      {info?.last
                        ? `פגישה אחרונה: ${formatDate(info.last)}${sinceLast ? ` (לפני ${sinceLast} ימים)` : ''}`
                        : nextDate
                          ? 'עדיין לא התקיימו פגישות'
                          : 'אין פגישות מתועדות'}
                    </p>
                    <p
                      className={classNames(
                        'font-medium',
                        nextDate
                          ? isOverdue(nextDate)
                            ? 'text-red-600'
                            : 'text-brand-700'
                          : 'text-amber-600',
                      )}
                    >
                      <CalendarDays size={13} className="ml-1 inline" />
                      {nextDate
                        ? `${nextIsFollowup ? 'מעקב הבא' : 'פגישה הבאה'}: ${formatDate(nextDate)}${isOverdue(nextDate) ? ' (באיחור)' : ''}`
                        : 'לא נקבעה פגישה הבאה'}
                    </p>
                  </div>

                  {d.doctor_hospitals.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
                      <Building2 size={13} />
                      {d.doctor_hospitals.slice(0, 3).map((h) => (
                        <span
                          key={h.hospital_id}
                          className="chip border-slate-200 bg-white text-slate-500"
                        >
                          {h.hospital?.name ?? '—'}
                        </span>
                      ))}
                      {d.doctor_hospitals.length > 3 && (
                        <span className="chip border-slate-200 bg-white text-slate-400">
                          +{d.doctor_hospitals.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
