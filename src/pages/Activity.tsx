import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity as ActivityIcon, AlertTriangle, CalendarDays, CheckCircle2, FileText, GitBranch, Stethoscope, Workflow } from 'lucide-react'
import { useDoctors } from '../lib/api'
import { useActivityState } from '../lib/activityApi'
import { ALL_KINDS, defaultFeedFilters, filterFeed, groupByDay, KIND_LABELS, weekSummary, type ActivityItem, type ActivityKind, type FeedFilters } from '../lib/activity'
import { EmptyState, ErrorState, Spinner } from '../components/ui'
import { classNames, formatDate, todayISO } from '../lib/utils'

const ICONS: Record<ActivityKind, typeof CalendarDays> = {
  meeting: CalendarDays,
  meeting_summary: FileText,
  investigation_open: AlertTriangle,
  investigation_closed: CheckCircle2,
  doctor: Stethoscope,
  stage: GitBranch,
  process: Workflow,
}
const TONE: Record<ActivityKind, string> = {
  meeting: 'bg-sky-100 text-sky-700',
  meeting_summary: 'bg-indigo-100 text-indigo-700',
  investigation_open: 'bg-amber-100 text-amber-800',
  investigation_closed: 'bg-green-100 text-green-700',
  doctor: 'bg-violet-100 text-violet-700',
  stage: 'bg-slate-100 text-slate-700',
  process: 'bg-teal-100 text-teal-700',
}
const DAY_OPTIONS = [7, 30, 90]

const timeOf = (iso: string) => (iso.length > 10 && !iso.includes('T12:00:00') ? new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '')

/** what is going on in the department: what colleagues did lately, the week at a glance and what is new since the last look */
export default function Activity() {
  const { items, loading, error, unread, seenAt, markSeen, kinds, setKinds } = useActivityState()
  const doctors = useDoctors()
  const [f, setF] = useState<FeedFilters>(defaultFeedFilters)
  const [showSettings, setShowSettings] = useState(false)
  const today = todayISO()
  // the items that were new when the page opened stay marked until the person says "seen"
  const unreadIds = useMemo(() => new Set(unread.map((u) => u.id)), [unread])

  const week = useMemo(() => weekSummary(items, today), [items, today])
  const shown = useMemo(() => filterFeed(items, f, today), [items, f, today])
  const days = useMemo(() => groupByDay(shown), [shown])
  const involved = useMemo(() => {
    const ids = new Set(items.flatMap((i) => i.doctors.map((d) => d.id)))
    return (doctors.data ?? []).filter((d) => ids.has(d.id))
  }, [items, doctors.data])

  if (loading) return <Spinner />
  if (error) return <ErrorState error={error} />

  const row = (it: ActivityItem) => {
    const Icon = ICONS[it.kind]
    const isNew = unreadIds.has(it.id)
    return (
      <li key={it.id} className={classNames('rounded-2xl border bg-white p-3 shadow-sm', isNew ? 'border-sky-300' : 'border-slate-200')}>
        <div className="flex items-start gap-2.5">
          <span className={classNames('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full', TONE[it.kind])}>
            <Icon size={16} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500">
              {KIND_LABELS[it.kind]}
              {it.actorName && ` · ${it.actorName}`}
              {timeOf(it.at) && ` · ${timeOf(it.at)}`}
              {isNew && <span className="ms-1.5 rounded-full bg-sky-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">חדש</span>}
            </p>
            <Link to={it.to} className="inline-flex min-h-[32px] items-center font-semibold text-brand-700 hover:underline">
              <span dir="auto" className="[overflow-wrap:anywhere]">{it.title}</span>
            </Link>
            {it.summary && <p dir="auto" className="text-sm text-slate-600 [overflow-wrap:anywhere]">{it.summary}</p>}
            {(it.doctors.length > 0 || it.hospital) && (
              <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
                {it.doctors.slice(0, 4).map((d) => (
                  <Link key={d.id} to={`/doctors/${d.id}`} className="inline-flex min-h-[28px] items-center rounded-full border border-brand-200 bg-brand-50 px-2.5 text-brand-800 hover:underline">
                    <span dir="auto">{d.name}</span>
                  </Link>
                ))}
                {it.hospital && <span className="inline-flex min-h-[28px] items-center rounded-full border border-slate-200 px-2.5 text-slate-600">{it.hospital}</span>}
              </p>
            )}
          </div>
        </div>
      </li>
    )
  }

  const count = (k: ActivityKind) => week.counts[k]
  return (
    <div className="space-y-3 sm:space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-brand-800 sm:text-3xl">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#00326d] text-white"><ActivityIcon size={20} aria-hidden /></span>
          מה קורה במחלקה
        </h1>
        <p className="text-sm text-slate-500">פגישות, סיכומים, תחקירים ושינויים של כל הצוות, כדי שכולם יהיו מעודכנים</p>
      </div>

      <section aria-label="השבוע במחלקה" className="rounded-2xl border border-slate-200 bg-white p-3">
        <h2 className="text-sm font-semibold text-slate-700">השבוע במחלקה <span className="font-normal text-slate-500">(מאז {formatDate(week.from)})</span></h2>
        {week.total === 0 ? (
          <p className="mt-1 text-sm text-slate-500">לא היו עדכונים בשבוע האחרון.</p>
        ) : (
          <>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {([['פגישות', count('meeting') + count('meeting_summary')], ['תחקירים שנפתחו', count('investigation_open')], ['תחקירים שנסגרו', count('investigation_closed')], ['שינויי שלב', count('stage')]] as const).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">{k}</p>
                  <p className="font-semibold text-slate-800">{v}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {week.busiest.length > 0 && <>הכי פעילים: {week.busiest.map((b) => `${b.name} (${b.count})`).join(', ')}. </>}
              {week.hospitals.length > 0 && <>בתי חולים עם הכי הרבה פגישות: {week.hospitals.map((h) => `${h.name} (${h.count})`).join(', ')}.</>}
            </p>
          </>
        )}
        <p className="mt-1 text-xs"><Link to="/investigations" className="text-brand-700 hover:underline">לכל התחקירים</Link></p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sky-50 px-3 py-2 text-sm">
        <span className="text-sky-900">
          {unread.length === 0 ? 'אין עדכונים חדשים מאז הביקור האחרון שלך' : unread.length === 1 ? 'עדכון חדש אחד מאז הביקור האחרון שלך' : `${unread.length} עדכונים חדשים מאז הביקור האחרון שלך`}
          <span className="text-xs text-sky-700"> ({formatDate(seenAt.slice(0, 10))})</span>
        </span>
        <div className="flex gap-2">
          {unread.length > 0 && <button type="button" className="btn-secondary !py-1 text-xs" onClick={markSeen}>סמן הכל כנקרא</button>}
          <button type="button" className="btn-ghost !py-1 text-xs" aria-expanded={showSettings} onClick={() => setShowSettings((v) => !v)}>אילו עדכונים לספור</button>
        </div>
      </div>
      {showSettings && (
        <fieldset className="rounded-xl border border-slate-200 bg-white p-3">
          <legend className="px-1 text-sm font-medium text-slate-700">המונה בתפריט ו"חדש" יספרו רק:</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {ALL_KINDS.map((k) => (
              <label key={k} className="flex min-h-[40px] items-center gap-2 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={kinds.includes(k)} onChange={(e) => setKinds(e.target.checked ? [...kinds, k] : kinds.filter((x) => x !== k))} />
                {KIND_LABELS[k]}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">ההגדרה נשמרת במכשיר הזה. עדכונים שיצרת בעצמך לא נספרים כחדשים.</p>
        </fieldset>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input type="search" className="input !w-full sm:!w-64" aria-label="חיפוש בעדכונים" placeholder="חיפוש: נושא, אדם, רופא, בית חולים" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <select className="input !w-full sm:!w-auto" aria-label="סוג עדכון" value={f.kinds.length === ALL_KINDS.length ? '' : f.kinds[0]} onChange={(e) => setF({ ...f, kinds: e.target.value ? [e.target.value as ActivityKind] : ALL_KINDS })}>
          <option value="">כל הסוגים</option>
          {ALL_KINDS.map((k) => (
            <option key={k} value={k}>{KIND_LABELS[k]}</option>
          ))}
        </select>
        <select className="input !w-full sm:!w-auto" aria-label="רופא" value={f.doctorId} onChange={(e) => setF({ ...f, doctorId: e.target.value })}>
          <option value="">כל הרופאים</option>
          {involved.map((d) => (
            <option key={d.id} value={d.id}>{d.title} {d.name}</option>
          ))}
        </select>
        <div role="radiogroup" aria-label="תקופה" className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
          {DAY_OPTIONS.map((n) => (
            <button key={n} type="button" role="radio" aria-checked={f.days === n} onClick={() => setF({ ...f, days: n })} className={classNames('min-h-[40px] rounded-lg px-3 text-sm font-medium', f.days === n ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600')}>
              {n === 7 ? 'שבוע' : n === 30 ? 'חודש' : 'רבעון'}
            </button>
          ))}
        </div>
      </div>

      {days.length === 0 ? (
        <EmptyState title="אין עדכונים בסינון הזה" hint="נסה תקופה ארוכה יותר או לנקות את הסינון" />
      ) : (
        days.slice(0, 40).map((g) => (
          <section key={g.day} className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-500">{g.day === today ? 'היום' : formatDate(g.day)}</h2>
            <ul className="space-y-2">{g.items.slice(0, 60).map(row)}</ul>
          </section>
        ))
      )}
    </div>
  )
}
