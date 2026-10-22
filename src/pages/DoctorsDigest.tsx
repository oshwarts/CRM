import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { useDoctors, useMeetings, usePatientScans, useTasks } from '../lib/api'
import { useAllInvestigations } from '../lib/investigations'
import { useStageHistoryAll } from '../lib/pipeline'
import { buildRoster, PERIOD_LABELS, type DigestPeriod } from '../lib/doctorDigest'
import { matchesWords, searchWords, searchKey } from '../lib/contactMatch'
import { EmptyState, ErrorState, Spinner } from '../components/ui'
import { classNames, formatDate, todayISO } from '../lib/utils'

const PERIODS = Object.keys(PERIOD_LABELS) as DigestPeriod[]
type Filter = 'all' | 'attention' | 'nomeeting' | 'investigation'

const trend = (now: number, before: number) => (now > before ? '▲' : now < before ? '▼' : '')

/** the summary of all doctors: who needs a look, who was not met in the period, who has an open investigation */
export default function DoctorsDigest() {
  const doctors = useDoctors()
  const meetings = useMeetings()
  const scans = usePatientScans()
  const investigations = useAllInvestigations()
  const stages = useStageHistoryAll()
  const tasks = useTasks()
  const [period, setPeriod] = useState<DigestPeriod>('quarter')
  const [filter, setFilter] = useState<Filter>('attention')
  const [status, setStatus] = useState<'' | 'client' | 'potential'>('')
  const [q, setQ] = useState('')

  const roster = useMemo(
    () =>
      buildRoster(
        {
          today: todayISO(),
          doctors: (doctors.data ?? []).filter((d) => d.status !== 'lost'),
          meetings: (meetings.data ?? []).map((m) => ({ ...m, doctorIds: m.meeting_doctors.map((x) => x.doctor?.id).filter((x): x is string => !!x) })),
          scans: scans.data ?? [],
          investigations: investigations.data ?? [],
          stages: stages.data ?? [],
          tasks: tasks.data ?? [],
        },
        period,
      ),
    [doctors.data, meetings.data, scans.data, investigations.data, stages.data, tasks.data, period],
  )

  const words = searchWords(q)
  const shown = roster.filter((r) => {
    if (status && r.doctor.status !== status) return false
    if (words.length && !matchesWords(words, searchKey(r.doctor.name))) return false
    if (filter === 'attention') return r.warnings > 0
    if (filter === 'nomeeting') return r.digest.meetings.count === 0
    if (filter === 'investigation') return r.digest.investigations.openNow > 0
    return true
  })

  const count = (f: Filter) => roster.filter((r) => (f === 'attention' ? r.warnings > 0 : f === 'nomeeting' ? r.digest.meetings.count === 0 : f === 'investigation' ? r.digest.investigations.openNow > 0 : true)).length
  const totals = roster.reduce((t, r) => ({ meetings: t.meetings + r.digest.meetings.count, surgeries: t.surgeries + r.digest.surgeries.done }), { meetings: 0, surgeries: 0 })

  if (doctors.isLoading || meetings.isLoading) return <Spinner />
  if (doctors.error && !doctors.data) return <ErrorState error={doctors.error} />

  const chip = (f: Filter, label: string) => (
    <button
      key={f}
      type="button"
      aria-pressed={filter === f}
      onClick={() => setFilter(f)}
      className={classNames('min-h-[40px] rounded-full border px-3 text-sm font-medium', filter === f ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}
    >
      {label} ({count(f)})
    </button>
  )

  return (
    <div className="space-y-3 sm:space-y-4">
      <div>
        <Link to="/doctors" className="inline-flex min-h-[40px] items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
          <ArrowRight size={14} aria-hidden /> לרשימת הרופאים
        </Link>
        <h1 className="text-2xl font-semibold text-brand-800 sm:text-3xl">מה חדש עם הרופאים</h1>
        <p className="text-sm text-slate-500">סיכום לכל הרופאים לפי תקופה, ומי צריך תשומת לב. נבנה מנתוני המערכת.</p>
      </div>

      <div role="radiogroup" aria-label="תקופה" className="grid grid-cols-4 gap-1.5 sm:max-w-md">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={period === p}
            onClick={() => setPeriod(p)}
            className={classNames('min-h-[40px] rounded-xl border px-1 text-sm font-medium', period === p ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-xs text-slate-500">רופאים</p><p className="font-semibold">{roster.length}</p></div>
        <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-xs text-slate-500">פגישות בתקופה</p><p className="font-semibold">{totals.meetings}</p></div>
        <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-xs text-slate-500">ניתוחים שבוצעו</p><p className="font-semibold">{totals.surgeries}</p></div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {chip('attention', 'צריכים תשומת לב')}
        {chip('nomeeting', 'בלי פגישה בתקופה')}
        {chip('investigation', 'תחקיר פתוח')}
        {chip('all', 'הכל')}
      </div>
      <div className="flex flex-wrap gap-2">
        <input type="search" className="input !w-full sm:!w-64" placeholder="חיפוש רופא" aria-label="חיפוש רופא" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input !w-full sm:!w-auto" aria-label="סטטוס" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="">לקוחות ופוטנציאליים</option>
          <option value="client">לקוחות</option>
          <option value="potential">פוטנציאליים</option>
        </select>
      </div>

      {shown.length === 0 ? (
        <EmptyState title="אין רופאים בסינון הזה" hint={filter === 'attention' ? 'אף רופא לא דורש תשומת לב בתקופה שנבחרה' : undefined} />
      ) : (
        <ul className="space-y-2">
          {shown.slice(0, 200).map(({ doctor, digest }) => (
            <li key={doctor.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <Link to={`/doctors/${doctor.id}`} className="inline-flex min-h-[32px] items-center font-semibold text-brand-700 hover:underline">
                  <span dir="auto">{doctor.title} {doctor.name}</span>
                </Link>
                <span className="text-xs text-slate-500">{doctor.status === 'client' ? 'לקוח' : 'פוטנציאלי'}</span>
              </div>
              <p className="mt-1 text-sm text-slate-700">
                פגישות: {digest.meetings.count} {trend(digest.meetings.count, digest.meetings.previous)}
                {digest.meetings.lastDate ? ` · אחרונה ${formatDate(digest.meetings.lastDate)}` : ''}
                {' · '}ניתוחים: {digest.surgeries.done} {trend(digest.surgeries.done, digest.surgeries.previous)}
                {digest.surgeries.postponed + digest.surgeries.cancelled > 0 ? ` · נדחו/בוטלו ${digest.surgeries.postponed + digest.surgeries.cancelled}` : ''}
              </p>
              {digest.alerts.length > 0 && (
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {digest.alerts.map((a) => (
                    <li key={a.text} className={classNames('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs', a.level === 'warn' ? 'bg-amber-100 text-amber-900' : 'bg-green-100 text-green-900')}>
                      {a.level === 'warn' && <AlertTriangle size={12} aria-hidden />}
                      {a.text}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      {shown.length > 200 && <p className="text-xs text-slate-500">מוצגים 200 מתוך {shown.length}. צמצם בעזרת החיפוש או הסינון.</p>}
    </div>
  )
}
