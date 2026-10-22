import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarDays, Clock, FolderKanban, Scissors, Stethoscope, Sun } from 'lucide-react'
import { useDoctors, useFavorites, useMeetings, usePatientScans, useTasks } from '../lib/api'
import { ErrorState } from './ui'
import { useProjects } from '../lib/projectsApi'
import { projectStats } from '../lib/projects'
import { useAuth } from '../context/AuthProvider'
import { contactState, cadenceLabel } from '../lib/cadence'
import { SCAN_PROCEDURE_LABELS } from '../lib/types'
import { classNames, daysUntil, formatDate, formatTime, plusDaysISO } from '../lib/utils'
import { useToday } from '../lib/useToday'
import { inDaysLabel, lateByLabel, meetingsOnDays } from '../lib/homeLogic'
import { HomeTasks } from './HomeTasks'
import { MyGoals } from './MyGoals'
import { MyTraining } from './MyTraining'
import { MeetingFormModal } from './MeetingFormModal'

/** "My day": surgeries and meetings of today and tomorrow, my tasks, and the doctors I should get back to */
export function TodayBlock() {
  const { user } = useAuth()
  const scans = usePatientScans()
  const meetings = useMeetings()
  const doctors = useDoctors()
  const favorites = useFavorites()
  const projects = useProjects()
  const allTasks = useTasks()
  const [scheduleFor, setScheduleFor] = useState<string | null>(null)

  const today = useToday()
  const tomorrow = plusDaysISO(1)
  const dayWord = (iso: string) => (iso === today ? 'היום' : 'מחר')

  const surgeries = useMemo(
    () =>
      (scans.data ?? [])
        .filter((s) => s.status !== 'cancelled' && s.surgery_date && (s.surgery_date === today || s.surgery_date === tomorrow))
        .sort((a, b) => (a.surgery_date ?? '').localeCompare(b.surgery_date ?? '')),
    [scans.data, today, tomorrow],
  )

  // the same "mine" as the number in the hero (an unowned meeting is everybody's)
  const todaysMeetings = useMemo(() => meetingsOnDays(meetings.data ?? [], [today, tomorrow], user?.id), [meetings.data, user?.id, today, tomorrow])

  // (not memoised: contactState reads the clock, and only the few favourites with a cadence are computed)
  const favIds = new Set(favorites.data ?? [])
  const toContact = (doctors.data ?? [])
    .filter((d) => favIds.has(d.id) && d.contact_cadence_days)
    .map((d) => ({ d, st: contactState(d, meetings.data ?? []) }))
    .filter((x) => x.st.status === 'due' || x.st.status === 'soon')
    .sort((a, b) => (a.st.daysToDue ?? 0) - (b.st.daysToDue ?? 0))

  // active projects that have something stuck or late
  const projectAlerts = useMemo(
    () =>
      (projects.data ?? [])
        .filter((p) => p.status === 'active')
        .map((p) => ({ p, stats: projectStats((allTasks.data ?? []).filter((t) => t.project_id === p.id)) }))
        .filter((x) => x.stats.blocked.length > 0 || x.stats.overdue.length > 0)
        .sort((a, b) => b.stats.blocked.length + b.stats.overdue.length - (a.stats.blocked.length + a.stats.overdue.length)),
    [projects.data, allTasks.data],
  )

  const sub = 'mb-1 flex items-center gap-1.5 text-sm font-semibold text-brand-700'

  return (
    <section id="home-today" className="card scroll-mt-20 space-y-4 p-4 sm:p-5">
      <h2 className="flex items-center gap-2.5 text-lg font-semibold text-brand-800">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-500">
          <Sun size={18} aria-hidden />
        </span>
        היום שלי
      </h2>

      {[scans, meetings, doctors, favorites].some((q) => q.error && !q.data) && <ErrorState error={[scans, meetings, doctors, favorites].find((q) => q.error && !q.data)?.error} />}

      {surgeries.length > 0 && (
        <div>
          <h3 className={sub}>
            <Scissors size={13} aria-hidden /> ניתוחים היום ומחר
          </h3>
          <ul className="divide-y divide-slate-100">
            {surgeries.map((s) => (
              <li key={s.id}>
                <Link to="/scans" className="flex min-h-[44px] flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg px-1.5 py-2 text-sm transition hover:bg-brand-50/60">
                  <span className={classNames('chip !px-2 !py-0 text-xs', s.surgery_date === today ? 'border-red-200 bg-red-50 text-red-600' : 'border-slate-200 bg-slate-50 text-slate-600')}>
                    {dayWord(s.surgery_date as string)}
                  </span>
                  <span dir="auto" className="font-medium text-slate-800">
                    {SCAN_PROCEDURE_LABELS[s.procedure_type] ?? s.procedure_type} {s.side}
                  </span>
                  <span dir="auto" className="min-w-0 break-words text-slate-600">
                    {[s.hospital?.name, s.surgeon ? `${s.surgeon.title} ${s.surgeon.name}`.trim() : ''].filter(Boolean).join(' · ')}
                  </span>
                  {!s.plan_ready && <span className="chip border-amber-200 bg-amber-50 !px-2 !py-0 text-xs text-amber-700">תוכנית לא מוכנה</span>}
                  {s.ct_date && !s.disk_collected && <span className="chip border-amber-200 bg-amber-50 !px-2 !py-0 text-xs text-amber-700">דיסק לא הועלה</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {todaysMeetings.length > 0 && (
        <div>
          <h3 className={sub}>
            <CalendarDays size={13} aria-hidden /> פגישות היום ומחר
          </h3>
          <ul className="divide-y divide-slate-100">
            {todaysMeetings.map((m) => (
              <li key={m.id}>
                <Link to={`/meetings/${m.id}`} className="flex min-h-[44px] flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg px-1.5 py-2 text-sm transition hover:bg-brand-50/60">
                  <span className={classNames('chip !px-2 !py-0 text-xs', m.meeting_date === today ? 'border-red-200 bg-red-50 text-red-600' : 'border-slate-200 bg-slate-50 text-slate-600')}>
                    {dayWord(m.meeting_date as string)}
                    {m.meeting_time ? ` ${formatTime(m.meeting_time)}` : ''}
                  </span>
                  <span dir="auto" className="min-w-0 break-words font-medium text-slate-800">{m.subject || 'פגישה'}</span>
                  <span dir="auto" className="min-w-0 break-words text-slate-600">
                    {[m.meeting_doctors.flatMap((x) => (x.doctor ? [x.doctor.name] : [])).join(', '), m.hospital?.name, m.location].filter(Boolean).join(' · ')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {projectAlerts.length > 0 && (
        <div>
          <h3 className={sub}>
            <FolderKanban size={13} aria-hidden /> פרויקטים שדורשים תשומת לב
          </h3>
          <ul className="divide-y divide-slate-100">
            {projectAlerts.slice(0, 4).map(({ p, stats }) => (
              <li key={p.id}>
                <Link to={`/projects/${p.id}`} className="flex min-h-[44px] flex-wrap items-center justify-between gap-2 rounded-lg px-1.5 py-2 text-sm transition hover:bg-brand-50/60">
                  <span dir="auto" className="min-w-0 break-words font-medium text-slate-800">
                    {p.name}
                  </span>
                  <span className="flex items-center gap-2 text-xs">
                    {stats.blocked.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-red-600">
                        <AlertTriangle size={12} aria-hidden /> {stats.blocked.length} {stats.blocked.length === 1 ? 'תקועה' : 'תקועות'}
                      </span>
                    )}
                    {stats.overdue.length > 0 && <span className="text-amber-700">{stats.overdue.length} באיחור</span>}
                    <span className="text-slate-600">{stats.percent}%</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <MyGoals />
      <MyTraining />

      <HomeTasks embedded />

      {toContact.length > 0 && (
        <div>
          <h3 className={sub}>
            <Stethoscope size={13} aria-hidden /> רופאים לחזור אליהם
          </h3>
          <ul className="divide-y divide-slate-100">
            {toContact.slice(0, 6).map(({ d, st }) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm">
                <Link to={`/doctors/${d.id}`} className="flex min-h-[44px] min-w-0 flex-1 basis-40 flex-col justify-center hover:underline">
                  <span className="font-medium text-slate-800">
                    {d.title} {d.name}
                  </span>
                  <span className="block text-xs text-slate-600">
                    {cadenceLabel(d.contact_cadence_days)} ·{' '}
                    {st.lastDate ? `קשר אחרון ${formatDate(st.lastDate)}` : 'אין פגישה מתועדת'}
                  </span>
                </Link>
                <div className="flex items-center gap-2">
                  <span className={classNames('text-xs', st.status === 'due' ? 'font-medium text-red-600' : 'text-amber-700')}>
                    <Clock size={12} aria-hidden className="ml-0.5 inline" />
                    {st.status === 'due' ? lateByLabel(Math.abs(daysUntil(st.dueDate) ?? 0)) : inDaysLabel(st.daysToDue ?? 0)}
                  </span>
                  <button className="btn-secondary !px-3 !py-1 text-xs" onClick={() => setScheduleFor(d.id)} aria-label={`קבע פגישה עם ${d.title} ${d.name}`}>
                    קבע פגישה
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {toContact.length > 6 && <p className="mt-1 text-xs text-slate-600">ועוד {toContact.length - 6}…</p>}
        </div>
      )}

      {scheduleFor && <MeetingFormModal open onClose={() => setScheduleFor(null)} defaultDoctorId={scheduleFor} />}
    </section>
  )
}
