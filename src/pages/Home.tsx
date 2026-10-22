import { useMemo, useRef, useState } from 'react'
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
import { EmptyState, ErrorState, Spinner } from '../components/ui'
import { MeetingFormModal } from '../components/MeetingFormModal'
import { TaskFormModal } from '../components/TaskFormModal'
import { useTasks } from '../lib/api'
import { TodayBlock } from '../components/TodayBlock'
import { ReferralImportModal } from '../components/ReferralImportModal'
import { ScanFormModal, type ScanDraft } from '../components/ScanFormModal'
import { PlannedSurgeryModal } from '../components/PlannedSurgeryModal'
import { classNames, daysUntil, formatDate, isOverdue, plusDaysISO, todayISO } from '../lib/utils'
import { useToday } from '../lib/useToday'
import {
  agoLabel,
  countWord,
  favFollowUp,
  inDaysLabel,
  isMyMeeting,
  meetingInfoByDoctor as buildMeetingInfo,
  meetingReminders,
  meetingsOnDays,
  scanAlerts as buildScanAlerts,
  surgeryWindowEnd,
} from '../lib/homeLogic'
import type { RescanKind } from '../lib/scanAlerts'

type SurgeryRange = '7' | '14' | '30' | 'date'
const RANGE_KEY = 'ami.home.surgeryRange'
const SCAN_HOSPITAL_KEY = 'ami.home.scanHospital'

function loadRange(): { range: SurgeryRange; until: string } {
  try {
    const raw = JSON.parse(localStorage.getItem(RANGE_KEY) ?? 'null')
    if (raw && ['7', '14', '30', 'date'].includes(raw.range))
      // (a chosen date that has passed is forgotten, so that the field never shows a date the block is not using)
      return { range: raw.range, until: typeof raw.until === 'string' && raw.until >= todayISO() ? raw.until : '' }
  } catch {
    // storage unavailable — use the default
  }
  return { range: '7', until: '' }
}

const RESCAN_LABEL: Record<RescanKind, string> = {
  today: 'היום',
  soon: '',
  overdue: 'באיחור',
  nodate: 'ללא תאריך',
}

/** one number of the top strip: tinted by what it means, links to the section below (a column of number + label on the phone) */
function Kpi({ href, icon, value, label, tone }: { href: string; icon: React.ReactNode; value: number | null; label: string; tone: 'blue' | 'red' | 'amber' | 'green' }) {
  const has = (value ?? 0) > 0
  const tones = {
    blue: 'bg-brand-50 text-brand-700',
    red: has ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500',
    amber: has ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-500',
    green: 'bg-emerald-50 text-emerald-700',
  }
  const numTone = {
    blue: 'text-brand-800',
    red: has ? 'text-red-600' : 'text-brand-800',
    amber: has ? 'text-amber-700' : 'text-brand-800',
    green: 'text-brand-800',
  }
  const edge = {
    blue: 'border-t-[#1863dc]',
    red: has ? 'border-t-[#cc3366]' : 'border-t-slate-200',
    amber: has ? 'border-t-[#d98e0a]' : 'border-t-slate-200',
    green: 'border-t-[#1d9a6c]',
  }
  const cls = classNames(
    'card flex min-w-0 flex-col items-center justify-center gap-0.5 border-t-[3px] px-1 py-2.5 text-center transition hover:shadow-pop sm:flex-row sm:justify-start sm:gap-3 sm:p-3.5 sm:text-start',
    edge[tone],
  )
  const body = (
    <>
      <span className={classNames('hidden h-11 w-11 shrink-0 place-items-center rounded-xl sm:grid', tones[tone])}>{icon}</span>
      <span className="min-w-0">
        <span className={classNames('block text-2xl font-semibold leading-none', numTone[tone])}>{value ?? '–'}</span>
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
      <h2 className="flex min-w-0 items-center gap-2.5 text-base font-semibold text-brand-800 sm:text-lg">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#00326d] text-white">{icon}</span>
        {title}
      </h2>
      {to && (
        <Link to={to} className="inline-flex min-h-[40px] shrink-0 items-center whitespace-nowrap text-sm font-medium text-brand-600 hover:underline">
          {linkLabel ?? 'הכול'} ←
        </Link>
      )}
    </div>
  )
}

/** a list folded away until it is needed (keeps the home page short, especially on the phone) */
function Fold({
  title,
  count,
  tone,
  defaultOpen = false,
  children,
}: {
  title: string
  count: number
  tone: 'amber' | 'fuchsia' | 'orange' | 'sky' | 'rose'
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const tones = {
    amber: 'border-amber-200 bg-amber-50/50 text-amber-800',
    fuchsia: 'border-fuchsia-200 bg-fuchsia-50/50 text-fuchsia-800',
    orange: 'border-orange-200 bg-orange-50/50 text-orange-800',
    sky: 'border-sky-200 bg-sky-50/50 text-sky-800',
    rose: 'border-rose-200 bg-rose-50/50 text-rose-800',
  }
  return (
    <details open={defaultOpen || undefined} className={classNames('group mt-2 rounded-xl border px-3', tones[tone])}>
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium">
        <span>
          {title} <span className="font-semibold">({count})</span>
        </span>
        <ChevronDown size={16} aria-hidden className="shrink-0 transition group-open:rotate-180" />
      </summary>
      <div className="pb-2 text-slate-700">{children}</div>
    </details>
  )
}

/** a patient line inside a fold: name and hospital on the left, what is missing as chips */
function PatientRow({ name, sub, children, tint }: { name: string; sub?: string; children: React.ReactNode; tint?: boolean }) {
  return (
    <li className={classNames('flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2', tint && 'rounded-lg bg-rose-50/70 px-2')}>
      <span className="min-w-0 flex-1 basis-40">
        <span dir="auto" className="block break-words text-sm font-medium text-slate-800">
          {name}
        </span>
        {sub ? (
          <span dir="auto" className="block break-words text-xs text-slate-600">
            {sub}
          </span>
        ) : null}
      </span>
      <span className="flex flex-wrap gap-1">{children}</span>
    </li>
  )
}

/** one count of the scans block: number first, then what it counts; a colour only when there is something to do */
function StatRow({ value, label, tone }: { value: number; label: string; tone: 'slate' | 'amber' | 'red' | 'fuchsia' | 'orange' }) {
  const on = {
    slate: 'bg-slate-50 hover:bg-brand-50 text-brand-800',
    amber: 'bg-amber-50 hover:bg-amber-100 text-amber-700',
    red: 'bg-red-50 hover:bg-red-100 text-red-600',
    fuchsia: 'bg-fuchsia-50 hover:bg-fuchsia-100 text-fuchsia-700',
    orange: 'bg-orange-50 hover:bg-orange-100 text-orange-700',
  }
  const zero = 'bg-slate-50 hover:bg-slate-100 text-slate-500'
  return (
    <Link to="/scans" className={classNames('flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 transition', value > 0 || tone === 'slate' ? on[tone] : zero)}>
      <span className="w-9 shrink-0 text-center text-2xl font-semibold leading-none">{value}</span>
      <span className="min-w-0 text-sm leading-snug text-slate-700">{label}</span>
    </Link>
  )
}

/** a small coloured heading inside a card (replaces boxes within boxes) */
function SubHead({ tone = 'slate', id, children }: { tone?: 'slate' | 'red' | 'sky' | 'rose'; id?: string; children: React.ReactNode }) {
  const t = { slate: 'text-slate-700', red: 'text-red-700', sky: 'text-sky-800', rose: 'text-rose-700' }
  return (
    <h3 id={id} className={classNames('mb-1 mt-5 scroll-mt-20 text-sm font-semibold first:mt-0', t[tone])}>
      {children}
    </h3>
  )
}

/** the list of a fold shows only the first few: say how many more there are and where to see them */
function More({ shown, total }: { shown: number; total: number }) {
  if (total <= shown) return null
  return (
    <Link to="/scans" className="mt-1 flex min-h-[40px] items-center text-sm font-medium text-brand-600 hover:underline">
      ועוד {total - shown} — לכל הסריקות ←
    </Link>
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
  const [allPotential, setAllPotential] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDetailsElement>(null)

  function changeRange(next: { range: SurgeryRange; until: string }) {
    setSurgeryRange(next)
    try {
      localStorage.setItem(RANGE_KEY, JSON.stringify(next))
    } catch {
      // not critical
    }
  }

  const today = useToday()
  // surgeries up to this date are listed under "ניתוחים עד" (a week by default)
  const surgeryUntil = surgeryWindowEnd(surgeryRange.range, surgeryRange.until, today, plusDaysISO)

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

  // (a failed save is reported, and the list put back, by the mutation itself)
  const setFavorite = (doctorId: string, isFavorite: boolean) => toggleFav.mutate({ doctorId, isFavorite })

  function changeScanHospital(id: string) {
    setScanHospital(id)
    try {
      localStorage.setItem(SCAN_HOSPITAL_KEY, id)
    } catch {
      // not critical
    }
  }

  const scanAlerts = useMemo(() => buildScanAlerts(homeScans, today, surgeryUntil), [homeScans, today, surgeryUntil])

  const allDoctors = useMemo(() => doctors.data ?? [], [doctors.data])
  const favSet = useMemo(() => new Set(favorites.data ?? []), [favorites.data])
  const favDoctors = useMemo(() => allDoctors.filter((d) => favSet.has(d.id)), [allDoctors, favSet])
  const potentialDoctors = allDoctors.filter((d) => d.status === 'potential')

  // per doctor: last meeting that took place, the next scheduled meeting, and the follow-up date recorded on the latest meeting
  const meetingInfoByDoctor = useMemo(() => buildMeetingInfo(meetings.data ?? [], today), [meetings.data, today])
  const favFollow = useMemo(() => favFollowUp(favDoctors, meetingInfoByDoctor, today), [favDoctors, meetingInfoByDoctor, today])

  const followups = useMemo(() => {
    return (meetings.data ?? [])
      .filter((m) => m.next_followup_date && m.status !== 'done' && m.status !== 'cancelled' && isMyMeeting(m, user?.id))
      .sort((a, b) => (a.next_followup_date ?? '').localeCompare(b.next_followup_date ?? ''))
  }, [meetings.data, user?.id])

  const reminders = useMemo(
    () => meetingReminders(meetings.data ?? [], user?.id, today, plusDaysISO(7)),
    [meetings.data, user?.id, today],
  )

  const reminderRow = (m: (typeof reminders.soon)[number], chip: string, chipClass: string) => (
    <li key={m.id}>
      <Link
        to={`/meetings/${m.id}`}
        className="flex min-h-[44px] flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg px-1 py-2 hover:bg-slate-50"
      >
        <div className="min-w-0 flex-1 basis-40">
          <p dir="auto" className="line-clamp-2 break-words text-sm font-medium text-slate-700">{m.subject || 'פגישה'}</p>
          <p dir="auto" className="line-clamp-2 break-words text-xs text-slate-600">
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

  const meetingsToday = meetingsOnDays(meetings.data ?? [], [today], user?.id).length
  const overdueTasks = (tasks.data ?? []).filter((t) => !t.is_done && t.status !== 'done' && t.assignee_id === user?.id && !!t.due_date && t.due_date < today).length
  // the hero must not claim "nothing today" while the data has not arrived (loading) or could not be read (error)
  const heroLoading = !meetings.data || !tasks.data
  const toFollow = favFollow.filter((f) => f.status === 'none' || f.status === 'overdue').length
  const dateLabel = useMemo(() => new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${today}T12:00:00`)), [today])
  const heroSecondary = 'btn flex-col !gap-1 !rounded-2xl border border-white/40 bg-white/10 !px-1 !py-2 text-xs text-white hover:bg-white/20 sm:flex-row sm:!gap-2 sm:!rounded-full sm:!px-5 sm:text-sm'

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="space-y-3 sm:space-y-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-[#00326d] via-[#0d4090] to-[#1863dc] p-4 text-white shadow-pop sm:p-7">
          <span aria-hidden className="pointer-events-none absolute -left-12 -top-14 h-48 w-48 rounded-full bg-white/10" />
          <span aria-hidden className="pointer-events-none absolute -bottom-16 left-24 h-40 w-40 rounded-full bg-[#cc3366]/30" />
          <div className="relative space-y-3 sm:space-y-4">
            <div>
              <p className="text-sm font-medium text-white/80">{dateLabel}</p>
              <h1 dir="auto" className="no-accent break-words text-2xl font-semibold !text-white sm:text-3xl">שלום{profile?.full_name ? `, ${profile.full_name}` : ''}</h1>
              <p className="mt-1 text-sm text-white/85">
                {heroLoading
                  ? ' '
                  : meetingsToday === 0 && overdueTasks === 0
                    ? 'אין היום פגישות ואין משימות באיחור'
                    : [
                        meetingsToday > 0 ? `${countWord(meetingsToday, 'פגישה אחת', 'פגישות')} היום` : '',
                        overdueTasks > 0 ? `${countWord(overdueTasks, 'משימה אחת', 'משימות')} באיחור` : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
              </p>
            </div>
            <div className="grid grid-cols-6 gap-2 sm:flex sm:flex-wrap">
              <button className="btn col-span-3 bg-[#ffffff] !text-[#00326d] hover:bg-[#f1f5f9]" onClick={() => setNewMeeting(true)}>
                <Plus size={16} aria-hidden /> פגישה חדשה
              </button>
              <button className="btn col-span-3 border border-white/40 bg-white/10 text-white hover:bg-white/20" onClick={() => setNewTask(true)}>
                <CheckSquare size={16} aria-hidden /> משימה חדשה
              </button>
              <button className={classNames(heroSecondary, 'col-span-2')} onClick={() => setAddSurgery(true)}>
                <Scissors size={16} aria-hidden /> ניתוח חדש
              </button>
              <button className={classNames(heroSecondary, 'col-span-2')} onClick={() => setAddScan(true)}>
                <ScanLine size={16} aria-hidden /> סריקה חדשה
              </button>
              <button className={classNames(heroSecondary, 'col-span-2')} onClick={() => setImportReferral(true)}>
                <FileInput size={16} aria-hidden /> ייבוא הפנייה
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
          <Kpi href="#home-today" icon={<CalendarDays size={20} />} value={heroLoading ? null : meetingsToday} label="פגישות היום" tone="blue" />
          <Kpi href="/tasks" icon={<AlertTriangle size={20} />} value={heroLoading ? null : overdueTasks} label="משימות באיחור" tone="red" />
          <Kpi href="#home-scans" icon={<ScanLine size={20} />} value={scans.data ? scanAlerts.upcoming.length : null} label="CT בשבוע הקרוב" tone="amber" />
          <Kpi href={favFollow.length > 0 ? '#home-fav-follow' : '#home-favorites'} icon={<Stethoscope size={20} />} value={favorites.data && doctors.data && meetings.data ? toFollow : null} label="רופאים לחזרה" tone="amber" />
        </div>
      </div>

      {isAdmin && pendingSignups.length > 0 && (
        <Link to="/users" className="card flex items-center gap-3 border-amber-300 bg-amber-50 p-3.5 text-amber-900 transition hover:shadow-pop">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
            <UserPlus size={20} aria-hidden />
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
      <section id="home-scans" className="card scroll-mt-20 p-4 sm:p-5">
        <SectionTitle icon={<ScanLine size={18} />} title="סריקות MAKO" to="/scans" linkLabel="לכל הסריקות" />
        <select
          className="input mb-3 sm:!w-auto"
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
        {scans.isLoading ? (
          <Spinner />
        ) : scans.error && !scans.data ? (
          <ErrorState error={scans.error} /> // cached data stays visible when only a background refresh failed
        ) : (
          <>
            <div className="grid gap-2 lg:grid-cols-3">
              <StatRow value={homeScans.length} label="סה״כ מטופלים" tone="slate" />
              <StatRow value={scanAlerts.upcoming.length} label="CT בשבוע הקרוב" tone="amber" />
              <StatRow value={scanAlerts.overdue.length} label="CT עבר — טרם נסרק" tone="red" />
            </div>

            <div className="mb-2 mt-4 flex flex-wrap items-center gap-x-2 gap-y-1">
              <label htmlFor="home-surgery-range" className="text-sm font-medium text-slate-700">
                ניתוחים עד
              </label>
              <select
                id="home-surgery-range"
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
                  min={today}
                  value={surgeryRange.until}
                  onChange={(e) => changeRange({ range: 'date', until: e.target.value })}
                  aria-label="תאריך סיום לניתוחים"
                />
              )}
              <span className="text-xs text-slate-600">עד <bdi>{formatDate(surgeryUntil)}</bdi></span>
            </div>
            <div className="grid gap-2 lg:grid-cols-2">
              <StatRow value={scanAlerts.noCtSoon.length} label="ניתוח עד התאריך — אין תאריך CT מתואם" tone="fuchsia" />
              <StatRow value={scanAlerts.noDiskSoon.length} label="ניתוח עד התאריך — הדיסק לא הועלה" tone="orange" />
            </div>
          </>
        )}
        {scanAlerts.rescans.length > 0 && (
          <Fold title="סריקה חוזרת — לוודא שהסוכן מגיע" count={scanAlerts.rescans.length} tone="rose" defaultOpen>
            <ul className="divide-y divide-rose-100">
              {scanAlerts.rescans.map(({ s, kind }) => (
                <PatientRow
                  key={s.id}
                  name={s.patient_name}
                  sub={[s.hospital?.name, s.rescan_reason].filter(Boolean).join(' · ')}
                  tint={kind === 'today' || kind === 'overdue'}
                >
                  <span className="chip border-rose-200 bg-white text-rose-700">
                    {[s.rescan_date ? formatDate(s.rescan_date) : '', RESCAN_LABEL[kind]].filter(Boolean).join(' · ')}
                  </span>
                </PatientRow>
              ))}
            </ul>
          </Fold>
        )}
        {scanAlerts.weekOpen.length > 0 && (
          <Fold title="CT בשבוע הקרוב — חסר טיפול" count={scanAlerts.weekOpen.length} tone="sky" defaultOpen>
            <ul className="divide-y divide-sky-100">
              {scanAlerts.weekOpen.slice(0, 8).map(({ s, missing }) => (
                <PatientRow key={s.id} name={s.patient_name} sub={`${s.hospital?.name ?? ''} · CT ${formatDate(s.ct_date)}`}>
                  {missing.map((m) => (
                    <span key={m} className="chip border-sky-200 bg-white text-sky-700">{m}</span>
                  ))}
                </PatientRow>
              ))}
            </ul>
            <More shown={8} total={scanAlerts.weekOpen.length} />
          </Fold>
        )}
        {scanAlerts.upcoming.length > 0 && (
          <Fold title="מטופלים עם CT בשבוע הקרוב" count={scanAlerts.upcoming.length} tone="amber">
            <ul className="divide-y divide-amber-100">
              {scanAlerts.upcoming.slice(0, 5).map((s) => (
                <PatientRow key={s.id} name={s.patient_name} sub={s.hospital?.name}>
                  <span className="chip border-amber-200 bg-white text-amber-700">CT {formatDate(s.ct_date)}</span>
                </PatientRow>
              ))}
            </ul>
            <More shown={5} total={scanAlerts.upcoming.length} />
          </Fold>
        )}
        {scanAlerts.noCtSoon.length > 0 && (
          <Fold title="ניתוחים בלי תאריך CT" count={scanAlerts.noCtSoon.length} tone="fuchsia">
            <ul className="divide-y divide-fuchsia-100">
              {scanAlerts.noCtSoon.slice(0, 10).map((s) => (
                <PatientRow key={s.id} name={s.patient_name} sub={s.hospital?.name}>
                  <span className="chip border-fuchsia-200 bg-white text-fuchsia-700">ניתוח {formatDate(s.surgery_date)} · אין CT</span>
                </PatientRow>
              ))}
            </ul>
            <More shown={10} total={scanAlerts.noCtSoon.length} />
          </Fold>
        )}
        {scanAlerts.noDiskSoon.length > 0 && (
          <Fold title="ניתוחים שהדיסק שלהם לא הועלה" count={scanAlerts.noDiskSoon.length} tone="orange">
            <ul className="divide-y divide-orange-100">
              {scanAlerts.noDiskSoon.slice(0, 10).map((s) => (
                <PatientRow key={s.id} name={s.patient_name} sub={s.hospital?.name}>
                  <span className="chip border-orange-200 bg-white text-orange-700">ניתוח {formatDate(s.surgery_date)} · דיסק לא הועלה</span>
                </PatientRow>
              ))}
            </ul>
            <More shown={10} total={scanAlerts.noDiskSoon.length} />
          </Fold>
        )}
      </section>

      {/* follow-ups */}
      <section id="home-meetings" className="card scroll-mt-20 p-4 sm:p-5">
        <SectionTitle icon={<Clock size={18} />} title="מעקב פגישות" to="/meetings" linkLabel="כל הפגישות" />
        {meetings.isLoading ? (
          <Spinner />
        ) : meetings.error && !meetings.data ? (
          <ErrorState error={meetings.error} />
        ) : followups.length === 0 && reminders.soon.length === 0 && reminders.missed.length === 0 && favFollow.length === 0 ? (
          <p className="text-sm text-slate-600">אין פגישות השבוע ואין פגישות שממתינות למעקב.</p>
        ) : (
          <>
            {reminders.missed.length > 0 && (
              <>
                <SubHead tone="red">עבר מועד הפגישה ({reminders.missed.length}) — עדכן סיכום וסטטוס או קבע מועד חדש</SubHead>
                <ul className="divide-y divide-red-100">
                  {reminders.missed.map((m) =>
                    reminderRow(m, `${formatDate(m.meeting_date)} · עבר`, 'border-red-200 bg-red-50 text-red-600'),
                  )}
                </ul>
              </>
            )}
            {reminders.soon.length > 0 && (
              <>
                <SubHead tone="sky">פגישות בשבוע הקרוב ({reminders.soon.length})</SubHead>
                <ul className="divide-y divide-slate-100">
                  {reminders.soon.map((m) => {
                    const when = inDaysLabel(daysUntil(m.meeting_date) ?? 0)
                    return reminderRow(m, `${when} · ${formatDate(m.meeting_date)}`, 'border-sky-200 bg-sky-50 text-sky-700')
                  })}
                </ul>
              </>
            )}
            {favFollow.length > 0 && (
              <>
                <SubHead id="home-fav-follow">מעקב רופאים מועדפים ({favFollow.length})</SubHead>
                <ul className="divide-y divide-slate-100">
                  {favFollow.map(({ d, info, nextDate, isFollowup, status }) => {
                    const chip =
                      status === 'none'
                        ? 'לא תואמה פגישה הבאה'
                        : `${isFollowup ? 'מעקב' : 'פגישה'}: ${formatDate(nextDate)}${status === 'overdue' ? ' · באיחור' : ''}`
                    const chipClass = {
                      overdue: 'border-red-200 bg-red-50 text-red-600',
                      none: 'border-amber-200 bg-amber-50 text-amber-700',
                      soon: 'border-sky-200 bg-sky-50 text-sky-700',
                      later: 'border-slate-200 bg-white text-slate-600',
                    }[status]
                    return (
                      <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-2">
                        <Link to={`/doctors/${d.id}`} className="flex min-h-[44px] min-w-0 flex-1 basis-full flex-col justify-center hover:underline sm:basis-48">
                          <p dir="auto" className="truncate text-sm font-medium text-slate-700">
                            {d.title} {d.name}
                          </p>
                          <p className="truncate text-xs text-slate-600">
                            {info?.last ? `פגישה אחרונה ${formatDate(info.last)} (${agoLabel(-(daysUntil(info.last) ?? 0))})` : 'עדיין לא התקיימו פגישות'}
                          </p>
                        </Link>
                        <span className="flex flex-wrap items-center gap-2">
                          <span className={classNames('chip', chipClass)}>{chip}</span>
                          {(status === 'none' || status === 'overdue') && (
                            <button className="btn-secondary !px-3 !py-1 text-xs" onClick={() => setScheduleFor(d.id)} aria-label={`קבע פגישה עם ${d.title} ${d.name}`}>
                              קבע פגישה
                            </button>
                          )}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
            {followups.length > 0 && (
              <>
                <SubHead>תאריכי מעקב ({followups.length})</SubHead>
                <ul className="divide-y divide-slate-100">
                  {followups.map((m) => {
                    const overdue = isOverdue(m.next_followup_date)
                    return (
                      <li key={m.id}>
                        <Link
                          to={`/meetings/${m.id}`}
                          className="flex min-h-[44px] flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg px-1 py-2 hover:bg-slate-50"
                        >
                          <div className="min-w-0 flex-1 basis-40">
                            <p dir="auto" className="line-clamp-2 break-words text-sm font-medium text-slate-700">
                              {m.subject || 'פגישה'}
                            </p>
                            <p dir="auto" className="line-clamp-2 break-words text-xs text-slate-600">
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
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
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
        <section className="card p-4 sm:p-5">
          <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-brand-800 sm:text-lg">
            <Target size={18} aria-hidden className="shrink-0 text-amber-500" />
            רופאים פוטנציאליים במעקב ({potentialDoctors.length})
          </h2>
          <ul className="divide-y divide-slate-100">
            {(allPotential ? potentialDoctors : potentialDoctors.slice(0, 5)).map((d) => (
              <li key={d.id}>
                <Link
                  to={`/doctors/${d.id}`}
                  className="block min-h-[44px] rounded-lg px-1 py-2 hover:bg-slate-50"
                >
                  <p dir="auto" className="break-words text-sm font-medium text-slate-700">
                    {d.title} {d.name}
                  </p>
                  {d.doctor_hospitals.length > 0 && (
                    <p className="break-words text-xs text-slate-600">
                      {d.doctor_hospitals
                        .map((h) => h.hospital?.name)
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  )}
                  {d.tracking_notes && (
                    <p dir="auto" className="line-clamp-2 break-words text-xs text-slate-500">
                      {d.tracking_notes}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          {potentialDoctors.length > 5 && (
            <button className="btn-ghost mt-1 w-full text-sm" onClick={() => setAllPotential((v) => !v)} aria-expanded={allPotential}>
              {allPotential ? 'הצג פחות' : `הצג את כל ${potentialDoctors.length}`}
            </button>
          )}
        </section>
      )}

      {/* favorite doctor cards */}
      <section id="home-favorites" className="scroll-mt-20">
        <SectionTitle icon={<Stethoscope size={18} />} title="הרופאים המועדפים שלי" to="/doctors" linkLabel="כל הרופאים" />

        {favorites.isLoading || doctors.isLoading ? (
          <Spinner />
        ) : (doctors.error && !doctors.data) || (favorites.error && !favorites.data) ? (
          <ErrorState error={doctors.error ?? favorites.error} />
        ) : favDoctors.length === 0 ? (
          <EmptyState
            title="עדיין לא סימנת רופאים מועדפים"
            hint="בחר רופאים ב״ניהול רשימת המועדפים״ שמתחת"
            action={
              allDoctors.length > 0 ? (
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setPickerOpen(true)
                    pickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }}
                >
                  בחר רופאים מועדפים
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {favDoctors.map((d) => {
              const info = meetingInfoByDoctor.get(d.id)
              const nextDate = info?.next ?? info?.followup
              const nextIsFollowup = !info?.next && !!info?.followup
                            return (
                <Link
                  key={d.id}
                  to={`/doctors/${d.id}`}
                  className="card flex flex-col gap-2.5 p-3.5 hover:border-brand-200 sm:gap-3 sm:p-4"
                >
                  <div className="flex items-center gap-3">
                    <div aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-500 text-white sm:h-11 sm:w-11">
                      <Stethoscope size={18} />
                    </div>
                    <div className="min-w-0">
                      <p dir="auto" className="truncate font-semibold text-slate-800">
                        {d.title} {d.name}
                      </p>
                      {d.position && (
                        <p dir="auto" className="truncate text-sm text-slate-600">
                          {d.position}
                        </p>
                      )}
                      {(d.phone || d.email) && (
                        <p className="truncate text-xs text-slate-600" dir="ltr">
                          {[d.phone, d.email].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <p className={info?.last ? 'text-slate-600' : 'text-slate-500'}>
                      <Clock size={13} aria-hidden className="ml-1 inline" />
                      {info?.last
                        ? `פגישה אחרונה: ${formatDate(info.last)} (${agoLabel(-(daysUntil(info.last) ?? 0))})`
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
                          : 'text-amber-700',
                      )}
                    >
                      <CalendarDays size={13} aria-hidden className="ml-1 inline" />
                      {nextDate
                        ? `${nextIsFollowup ? 'מעקב הבא' : 'פגישה הבאה'}: ${formatDate(nextDate)}${isOverdue(nextDate) ? ' (באיחור)' : ''}`
                        : 'לא נקבעה פגישה הבאה'}
                    </p>
                  </div>

                  {d.doctor_hospitals.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
                      <Building2 size={13} aria-hidden />
                      {d.doctor_hospitals.slice(0, 3).map((h) => (
                        <span
                          key={h.hospital_id}
                          className="chip border-slate-200 bg-white text-slate-600"
                        >
                          {h.hospital?.name ?? '—'}
                        </span>
                      ))}
                      {d.doctor_hospitals.length > 3 && (
                        <span className="chip border-slate-200 bg-white text-slate-600">
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

      {/* favorites picker */}
      <details ref={pickerRef} open={pickerOpen} onToggle={(e) => setPickerOpen(e.currentTarget.open)} className="card group p-4 sm:p-5">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 text-base font-semibold text-brand-800 sm:text-lg">
          <span className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-500">
              <Heart size={18} aria-hidden />
            </span>
            ניהול רשימת המועדפים
          </span>
          <ChevronDown size={18} aria-hidden className="shrink-0 text-slate-500 transition group-open:rotate-180" />
        </summary>
        <div className="mt-3">
          <select
            className="input sm:max-w-xs"
            aria-label="הוסף רופא לרשימה"
            value={toAdd}
            disabled={toggleFav.isPending}
            onChange={(e) => {
              const id = e.target.value
              setToAdd('')
              if (id && !favSet.has(id)) setFavorite(id, false)
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
          <ul className="mt-3 flex flex-wrap gap-2">
            {favDoctors.map((d) => (
              <li
                key={d.id}
                className="chip border-red-200 bg-red-50 !py-0 text-red-600"
              >
                {d.title} {d.name}
                <button
                  onClick={() => setFavorite(d.id, true)}
                  disabled={toggleFav.isPending}
                  aria-label={`הסר את ${d.name} מהמועדפים`}
                  className="grid min-h-[40px] min-w-[40px] place-items-center"
                >
                  <X size={13} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  )
}
