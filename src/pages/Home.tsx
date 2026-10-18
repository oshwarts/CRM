import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  Clock,
  FileInput,
  Heart,
  Plus,
  ScanLine,
  Stethoscope,
  Target,
  UserPlus,
  X,
  Scissors,
} from 'lucide-react'
import {
  useDoctors,
  usePendingSignups,
  useFavorites,
  useMeetings,
  usePatientScans,
  useToggleFavorite,
} from '../lib/api'
import { useAuth } from '../context/AuthProvider'
import { EmptyState, Spinner } from '../components/ui'
import { MeetingFormModal } from '../components/MeetingFormModal'
import { TaskFormModal } from '../components/TaskFormModal'
import { useTasks } from '../lib/api'
import { TodayBlock } from '../components/TodayBlock'
import { ReferralImportModal } from '../components/ReferralImportModal'
import { ScanFormModal, type ScanDraft } from '../components/ScanFormModal'
import { PlannedSurgeryModal } from '../components/PlannedSurgeryModal'
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
const SCAN_HOSPITAL_KEY = 'ami.home.scanHospital'

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

/** one number of the top strip: tinted by what it means, links to the section below */
function Kpi({ href, icon, value, label, tone }: { href: string; icon: React.ReactNode; value: number; label: string; tone: 'blue' | 'red' | 'amber' | 'green' }) {
  const tones = {
    blue: 'bg-brand-50 text-brand-700',
    red: value > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500',
    amber: value > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-500',
    green: 'bg-emerald-50 text-emerald-700',
  }
  const edge = {
    blue: 'border-t-[#1863dc]',
    red: value > 0 ? 'border-t-[#cc3366]' : 'border-t-slate-200',
    amber: value > 0 ? 'border-t-[#d98e0a]' : 'border-t-slate-200',
    green: 'border-t-[#1d9a6c]',
  }
  const cls = classNames('card flex items-center gap-3 border-t-[3px] p-3.5 transition hover:shadow-pop', edge[tone])
  const body = (
    <>
      <span className={classNames('grid h-11 w-11 shrink-0 place-items-center rounded-xl', tones[tone])}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-2xl font-semibold leading-none text-brand-800">{value}</span>
        <span className="mt-1 block text-xs leading-tight text-slate-600">{label}</span>
      </span>
    </>
  )
  // a page link goes through the router (a plain <a href="/tasks"> reloads the whole app); "#…" jumps inside this page
  return href.startsWith('#') ? (
    <a href={href} className={cls}>
      {body}
    </a>
  ) : (
    <Link to={href} className={cls}>
      {body}
    </Link>
  )
}

/** a titled section of the home page: icon in a tinted square, title, optional link */
function SectionTitle({ icon, title, to, linkLabel }: { icon: React.ReactNode; title: string; to?: string; linkLabel?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="flex min-w-0 items-center gap-2.5 whitespace-nowrap text-base font-semibold text-brand-800 sm:text-lg">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#00326d] text-white">{icon}</span>
        {title}
      </h2>
      {to && (
        <Link to={to} className="shrink-0 whitespace-nowrap text-sm font-medium text-brand-600 hover:underline">
          {linkLabel ?? 'הכול'} ←
        </Link>
      )}
    </div>
  )
}

/** a list folded away until it is needed (keeps the home page short, especially on the phone) */
function Fold({ title, count, tone, children }: { title: string; count: number; tone: 'amber' | 'fuchsia' | 'orange' | 'sky' | 'rose'; children: React.ReactNode }) {
  const tones = {
    amber: 'border-amber-200 bg-amber-50/50 text-amber-800',
    fuchsia: 'border-fuchsia-200 bg-fuchsia-50/50 text-fuchsia-800',
    orange: 'border-orange-200 bg-orange-50/50 text-orange-800',
    sky: 'border-sky-200 bg-sky-50/50 text-sky-800',
    rose: 'border-rose-200 bg-rose-50/50 text-rose-800',
  }
  return (
    <details className={classNames('group mt-3 rounded-xl border px-3 py-2', tones[tone])}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium">
        <span>
          {title} <span className="font-semibold">({count})</span>
        </span>
        <ChevronDown size={16} className="transition group-open:rotate-180" />
      </summary>
      <div className="mt-2 text-slate-700">{children}</div>
    </details>
  )
}

export default function Home() {
  const { user, profile, isAdmin } = useAuth()
  const pendingSignups = usePendingSignups().data ?? []
  const doctors = useDoctors()
  const favorites = useFavorites()
  const meetings = useMeetings()
  const scans = usePatientScans()
  const toggleFav = useToggleFavorite()
  const tasks = useTasks()
  const [newMeeting, setNewMeeting] = useState(false)
  const [newTask, setNewTask] = useState(false)
  const [toAdd, setToAdd] = useState('')
  const [surgeryRange, setSurgeryRange] = useState(loadRange)
  const [scheduleFor, setScheduleFor] = useState<string | null>(null)
  const [scanHospital, setScanHospital] = useState(() => {
    try {
      return localStorage.getItem(SCAN_HOSPITAL_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [addScan, setAddScan] = useState(false)
  const [addSurgery, setAddSurgery] = useState(false)
  const [importReferral, setImportReferral] = useState(false)
  const [scanPrefill, setScanPrefill] = useState<{ draft: Partial<ScanDraft>; notices: string[] } | null>(null)

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

  // hospitals that appear in the scans, for the filter of the scans block
  const scanHospitals = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of scans.data ?? []) if (s.hospital) m.set(s.hospital.id, s.hospital.name)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'he'))
  }, [scans.data])
  // a hospital that no longer has scans must not leave the block empty
  const hospitalFilter = scanHospitals.some(([id]) => id === scanHospital) ? scanHospital : ''
  const homeScans = useMemo(
    () => (scans.data ?? []).filter((s) => !hospitalFilter || s.hospital?.id === hospitalFilter),
    [scans.data, hospitalFilter],
  )

  function changeScanHospital(id: string) {
    setScanHospital(id)
    try {
      localStorage.setItem(SCAN_HOSPITAL_KEY, id)
    } catch {
      // not critical
    }
  }

  const scanAlerts = useMemo(() => {
    const t = todayISO()
    const list = homeScans
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
      // ניתוח בשבוע הקרוב, יש CT אבל הדיסק טרם הועלה
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
  }, [homeScans, surgeryUntil])

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
        } else if (m.status !== 'scheduled' && (!cur.last || m.meeting_date > cur.last)) {
          // (a "scheduled" meeting whose date passed was never closed — it is not a meeting that took place)
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

  const todayStr = todayISO()
  const meetingsToday = (meetings.data ?? []).filter(
    (m) =>
      m.meeting_date === todayStr &&
      m.status !== 'cancelled' &&
      (!m.responsible_agent_id || m.responsible_agent_id === user?.id || m.meeting_agents.some((a) => a.agent?.id === user?.id)),
  ).length
  const overdueTasks = (tasks.data ?? []).filter((t) => !t.is_done && t.status !== 'done' && t.assignee_id === user?.id && !!t.due_date && t.due_date < todayStr).length
  const toFollow = favFollow.filter((f) => f.status === 'none' || f.status === 'overdue').length
  const dateLabel = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-[#00326d] via-[#0d4090] to-[#1863dc] p-5 text-white shadow-pop sm:p-7">
          <span aria-hidden className="pointer-events-none absolute -left-12 -top-14 h-48 w-48 rounded-full bg-white/10" />
          <span aria-hidden className="pointer-events-none absolute -bottom-16 left-24 h-40 w-40 rounded-full bg-[#cc3366]/30" />
          <div className="relative space-y-4">
            <div>
              <p className="text-sm font-medium text-white/80">{dateLabel}</p>
              <h1 className="no-accent text-3xl font-semibold !text-white">שלום{profile?.full_name ? `, ${profile.full_name}` : ''}</h1>
              <p className="mt-1 text-sm text-white/85">
                {meetingsToday === 0 && overdueTasks === 0
                  ? 'אין היום פגישות ואין משימות באיחור'
                  : [meetingsToday > 0 ? `${meetingsToday} פגישות היום` : '', overdueTasks > 0 ? `${overdueTasks} משימות באיחור` : ''].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <button className="btn bg-[#ffffff] !text-[#00326d] hover:bg-[#f1f5f9]" onClick={() => setNewMeeting(true)}>
                <Plus size={16} /> פגישה חדשה
              </button>
              <button className="btn border border-white/40 bg-white/10 text-white hover:bg-white/20" onClick={() => setNewTask(true)}>
                <CheckSquare size={16} /> משימה חדשה
              </button>
              <button className="btn border border-white/40 bg-white/10 text-white hover:bg-white/20" onClick={() => setAddSurgery(true)}>
                <Scissors size={16} /> ניתוח חדש
              </button>
              <button className="btn border border-white/40 bg-white/10 text-white hover:bg-white/20" onClick={() => setAddScan(true)}>
                <ScanLine size={16} /> סריקה חדשה
              </button>
              <button className="btn border border-white/40 bg-white/10 text-white hover:bg-white/20" onClick={() => setImportReferral(true)}>
                <FileInput size={16} /> ייבוא הפנייה
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi href="#home-meetings" icon={<CalendarDays size={20} />} value={meetingsToday} label="פגישות היום" tone="blue" />
          <Kpi href="/tasks" icon={<AlertTriangle size={20} />} value={overdueTasks} label="משימות באיחור" tone="red" />
          <Kpi href="#home-scans" icon={<ScanLine size={20} />} value={scanAlerts.upcoming.length} label="CT בשבוע הקרוב" tone="amber" />
          <Kpi href="#home-favorites" icon={<Stethoscope size={20} />} value={toFollow} label="רופאים לחזרה" tone="amber" />
        </div>
      </div>

      {isAdmin && pendingSignups.length > 0 && (
        <Link to="/users" className="card flex items-center gap-3 border-amber-300 bg-amber-50 p-3.5 text-amber-900 transition hover:shadow-pop">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
            <UserPlus size={20} />
          </span>
          <span className="min-w-0 text-sm">
            <span className="block font-semibold">
              {pendingSignups.length === 1 ? 'משתמש אחד ממתין לאישור' : `${pendingSignups.length} משתמשים ממתינים לאישור`}
            </span>
            <span className="block truncate text-xs text-amber-800">
              {pendingSignups.map((u) => u.full_name || u.email).join(' · ')} — לחץ לאישור
            </span>
          </span>
        </Link>
      )}

      <TodayBlock />

      {/* MAKO scans */}
      <section id="home-scans" className="card scroll-mt-20 p-5">
        <SectionTitle icon={<ScanLine size={18} />} title="סריקות MAKO" to="/scans" linkLabel="לכל הסריקות" />
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            className="input !w-auto"
            value={hospitalFilter}
            onChange={(e) => changeScanHospital(e.target.value)}
            aria-label="סינון סריקות לפי בית חולים"
          >
            <option value="">כל בתי החולים</option>
            {scanHospitals.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
        {scans.isLoading ? (
          <Spinner />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Link to="/scans" className="rounded-2xl bg-slate-50 p-4 text-center transition hover:bg-brand-50">
                <p className="text-3xl font-semibold text-brand-800">{homeScans.length}</p>
                <p className="mt-0.5 text-xs text-slate-500">סה״כ מטופלים</p>
              </Link>
              <Link
                to="/scans"
                className={classNames(
                  'rounded-2xl p-4 text-center transition',
                  scanAlerts.upcoming.length ? 'bg-amber-50 hover:bg-amber-100' : 'bg-slate-50',
                )}
              >
                <p className="text-3xl font-semibold text-amber-600">{scanAlerts.upcoming.length}</p>
                <p className="mt-0.5 text-xs text-slate-600">CT בשבוע הקרוב</p>
              </Link>
              <Link
                to="/scans"
                className={classNames(
                  'rounded-2xl p-4 text-center transition',
                  scanAlerts.overdue.length ? 'bg-red-50 hover:bg-red-100' : 'bg-slate-50',
                )}
              >
                <p className="text-3xl font-semibold text-red-600">{scanAlerts.overdue.length}</p>
                <p className="mt-0.5 text-xs text-slate-600">CT עבר — טרם נסרק</p>
              </Link>
            </div>

            <div className="mb-2 mt-4 flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                לקראת ניתוח — עד
              </p>
              <select
                className="input !w-auto !py-1 text-sm"
                aria-label="טווח הניתוחים להצגה"
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
            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/scans"
                className={classNames(
                  'rounded-2xl p-4 text-center transition',
                  scanAlerts.noCtSoon.length ? 'bg-fuchsia-50 hover:bg-fuchsia-100' : 'bg-slate-50',
                )}
              >
                <p className="text-3xl font-semibold text-fuchsia-600">{scanAlerts.noCtSoon.length}</p>
                <p className="mt-0.5 text-xs text-slate-600">ניתוח עד התאריך — אין תאריך CT מתואם</p>
              </Link>
              <Link
                to="/scans"
                className={classNames(
                  'rounded-2xl p-4 text-center transition',
                  scanAlerts.noDiskSoon.length ? 'bg-orange-50 hover:bg-orange-100' : 'bg-slate-50',
                )}
              >
                <p className="text-3xl font-semibold text-orange-600">{scanAlerts.noDiskSoon.length}</p>
                <p className="mt-0.5 text-xs text-slate-600">ניתוח עד התאריך — הדיסק לא הועלה</p>
              </Link>
            </div>
          </>
        )}
        {scanAlerts.upcoming.length > 0 && (
          <Fold title="מטופלים עם CT בשבוע הקרוב" count={scanAlerts.upcoming.length} tone="amber"><ul className="divide-y divide-slate-100 text-sm">
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
          </ul></Fold>
        )}
        {scanAlerts.noCtSoon.length > 0 && (
          <Fold title="ניתוחים בלי תאריך CT" count={scanAlerts.noCtSoon.length} tone="fuchsia"><ul className="divide-y divide-slate-100 text-sm">
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
          </ul></Fold>
        )}
        {scanAlerts.noDiskSoon.length > 0 && (
          <Fold title="ניתוחים שהדיסק שלהם לא הועלה" count={scanAlerts.noDiskSoon.length} tone="orange"><ul className="divide-y divide-slate-100 text-sm">
            {scanAlerts.noDiskSoon.slice(0, 10).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-1.5">
                <span className="text-slate-700">
                  {s.patient_name}
                  <span className="mr-2 text-xs text-slate-400">{s.hospital?.name}</span>
                </span>
                <span className="chip border-orange-200 bg-orange-50 text-orange-700">
                  ניתוח {formatDate(s.surgery_date)} · דיסק לא הועלה
                </span>
              </li>
            ))}
          </ul></Fold>
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

      {/* follow-ups */}
      <section id="home-meetings" className="card scroll-mt-20 p-5">
        <SectionTitle icon={<Clock size={18} />} title="מעקב פגישות" to="/meetings" linkLabel="כל הפגישות" />
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

      {newMeeting && <MeetingFormModal open onClose={() => setNewMeeting(false)} />}
      {newTask && <TaskFormModal onClose={() => setNewTask(false)} />}
      {scheduleFor && (
        <MeetingFormModal open onClose={() => setScheduleFor(null)} defaultDoctorId={scheduleFor} />
      )}

      {addScan && <ScanFormModal onClose={() => setAddScan(false)} />}
      {addSurgery && <PlannedSurgeryModal onClose={() => setAddSurgery(false)} />}
      {importReferral && (
        <ReferralImportModal
          onClose={() => setImportReferral(false)}
          onResult={(draft, notices) => {
            setImportReferral(false)
            setScanPrefill({ draft, notices })
          }}
        />
      )}
      {scanPrefill && (
        <ScanFormModal initial={scanPrefill.draft} notices={scanPrefill.notices} onClose={() => setScanPrefill(null)} />
      )}

      {/* potential doctors */}
      {potentialDoctors.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-brand-800">
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
      <details className="card p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-lg font-semibold text-brand-800">
          <span className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-500">
              <Heart size={18} />
            </span>
            ניהול רשימת המועדפים
          </span>
          <ChevronDown size={18} className="text-slate-400" />
        </summary>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            className="input max-w-xs"
            aria-label="הוסף רופא לרשימה"
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
      </details>

      {/* favorite doctor cards */}
      <section id="home-favorites" className="scroll-mt-20">
        <SectionTitle icon={<Stethoscope size={18} />} title="הרופאים המועדפים שלי" to="/doctors" linkLabel="כל הרופאים" />

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
