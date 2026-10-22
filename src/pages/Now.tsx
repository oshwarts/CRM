import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Lightbulb, CalendarDays, CheckCircle2, CheckSquare, DatabaseBackup, FileUp, RefreshCw, ScanLine, Stethoscope, Sun, Swords, Target } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { useAppSetting, useCompetitorIntel, useDoctors, useFavorites, useMeetings, useMyHospitalIds, usePatientScans, useTasks } from '../lib/api'
import { buildNow, type NowGroupId, type NowIcon } from '../lib/nowLogic'
import { countWord } from '../lib/homeLogic'
import { classNames } from '../lib/utils'
import { Spinner } from '../components/ui'
import { useStageHistoryAll, useStuckThresholds } from '../lib/pipeline'
import { useUploadRequests } from '../lib/largeFiles'
import { useProcedureRequests } from '../lib/procedures'
import { useSuggestions } from '../lib/suggestions'

type Tone = 'red' | 'amber' | 'blue'
const LIMIT = 8
const STEP = 50
const ICONS: Record<NowIcon, LucideIcon> = { task: CheckSquare, meeting: CalendarDays, scan: ScanLine, doctor: Stethoscope, competitor: Swords, target: Target, upload: FileUp, procedure: Stethoscope, suggestion: Lightbulb, backup: DatabaseBackup }
/** title, short name (for the jump strip), colour and icon of each group */
const GROUPS: Record<NowGroupId, { title: string; short: string; tone: Tone; icon: LucideIcon }> = {
  late: { title: 'באיחור — לטפל קודם', short: 'באיחור', tone: 'red', icon: AlertTriangle },
  today: { title: 'היום', short: 'היום', tone: 'amber', icon: Sun },
  soon: { title: 'השבוע הקרוב', short: 'השבוע', tone: 'blue', icon: CalendarDays },
  contact: { title: 'רופאים לחזור אליהם', short: 'לחזור לרופאים', tone: 'blue', icon: Stethoscope },
  backup: { title: 'גיבוי נתונים', short: 'גיבוי', tone: 'amber', icon: DatabaseBackup },
  suggestions: { title: 'הצעות לשיפור המערכת', short: 'הצעות', tone: 'blue', icon: Lightbulb },
  procedures: { title: 'בקשות להליכים חדשים', short: 'הליכים חדשים', tone: 'amber', icon: Stethoscope },
  uploads: { title: 'קבצים גדולים — אישורי העלאה', short: 'קבצים גדולים', tone: 'amber', icon: FileUp },
  pipeline: { title: 'רופאים פוטנציאליים שדורשים דחיפה', short: 'פוטנציאליים', tone: 'amber', icon: Target },
  competitors: { title: 'הזדמנויות מול מתחרים', short: 'מתחרים', tone: 'amber', icon: Swords },
}

const TONE = {
  red: { box: 'border-red-200 bg-red-50/60', head: 'text-red-700', chip: 'border-red-200 bg-white text-red-600' },
  amber: { box: 'border-amber-200 bg-amber-50/50', head: 'text-amber-800', chip: 'border-amber-200 bg-white text-amber-700' },
  blue: { box: 'border-brand-100 bg-brand-50/50', head: 'text-brand-800', chip: 'border-brand-200 bg-white text-brand-700' },
}

/** everything that needs me, in one list ordered by urgency: late first, then today, then the coming days */
export default function Now() {
  const { user, isAdmin, isDeveloper } = useAuth()
  const tasks = useTasks()
  const meetings = useMeetings()
  const scans = usePatientScans()
  const doctors = useDoctors()
  const favorites = useFavorites()
  const competitorIntel = useCompetitorIntel()
  const myHospitals = useMyHospitalIds()
  const stageHistory = useStageHistoryAll()
  const stuckThresholds = useStuckThresholds()
  const uploads = useUploadRequests()
  const procRequests = useProcedureRequests()
  const suggestions = useSuggestions()
  const backupSetting = useAppSetting('backup.last')
  // how many rows of each group are shown: 8 at first, then 50 more with every press (a group can hold hundreds)
  const [shownCount, setShownCount] = useState<Record<string, number>>({})

  // the four lists the page cannot do without: while they load → a skeleton, if one failed with nothing to show → an error (never "all handled")
  const core = [tasks, meetings, scans, doctors]
  const loading = core.some((q) => q.isLoading)
  const failed = core.filter((q) => q.isError && !q.data)
  const pending = [favorites, competitorIntel, stageHistory, uploads, procRequests, suggestions, backupSetting].some((q) => q.isLoading)

  const groups = useMemo(
    () =>
      buildNow({
        userId: user?.id,
        isAdmin,
        isDeveloper,
        tasks: tasks.data ?? [],
        meetings: meetings.data ?? [],
        scans: scans.data ?? [],
        doctors: doctors.data ?? [],
        favorites: favorites.data ?? [],
        intel: competitorIntel.data ?? [],
        myHospitals,
        stageHistory: stageHistory.data ?? [],
        thresholds: stuckThresholds,
        uploads: uploads.data ?? [],
        procRequests: procRequests.data ?? [],
        suggestions: suggestions.data ?? [],
        lastBackup: backupSetting.data,
      }),
    [tasks.data, meetings.data, scans.data, doctors.data, favorites.data, competitorIntel.data, stageHistory.data, stuckThresholds, uploads.data, procRequests.data, suggestions.data, isDeveloper, backupSetting.data, myHospitals, isAdmin, user?.id],
  )

  const total = groups.reduce((n, g) => n + g.items.length, 0)

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-brand-800 sm:text-3xl">
          <AlertTriangle className="shrink-0 text-accent" size={26} aria-hidden />
          דחוף עכשיו
        </h1>
        <p className="text-sm text-slate-600">
          {loading || total === 0 ? 'מה שדורש אותך, בסדר דחיפות' : `${countWord(total, 'דבר אחד מחכה', 'דברים מחכים')} לך, לפי סדר דחיפות`}
        </p>
      </div>
      {failed.length > 0 && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p className="min-w-0 flex-1">לא הצלחנו לטעון חלק מהנתונים, לכן ייתכן שחסרים כאן דברים.</p>
          <button type="button" className="btn-secondary" onClick={() => failed.forEach((q) => void q.refetch())}>
            <RefreshCw size={15} aria-hidden /> נסה שוב
          </button>
        </div>
      )}
      {loading || (total === 0 && pending && failed.length === 0) ? (
        <Spinner />
      ) : total === 0 ? (
        failed.length > 0 ? null : (
          <div className="card flex flex-col items-center gap-2 p-10 text-center">
            <CheckCircle2 size={40} aria-hidden className="text-emerald-500" />
            <p className="text-lg font-semibold text-brand-800">הכול מטופל</p>
            <p className="text-sm text-slate-600">אין עכשיו משהו שמחכה לך.</p>
          </div>
        )
      ) : (
        <>
          {groups.length > 1 && (
            <nav aria-label="קפיצה לקבוצה" className="flex flex-wrap gap-2">
              {groups.map((g) => (
                <a key={g.id} href={`#now-${g.id}`} className={classNames('chip !min-h-[40px] items-center', TONE[GROUPS[g.id].tone].chip)}>
                  {GROUPS[g.id].short} <span className="font-semibold">{g.items.length}</span>
                </a>
              ))}
            </nav>
          )}
          {groups.map((g) => {
            const meta = GROUPS[g.id]
            const tone = TONE[meta.tone]
            const count = Math.min(shownCount[g.id] ?? LIMIT, g.items.length)
            const all = count >= g.items.length
            const shown = g.items.slice(0, count)
            const Icon = meta.icon
            return (
              <section key={g.id} id={`now-${g.id}`} aria-labelledby={`now-h-${g.id}`} className={classNames('scroll-mt-20 rounded-2xl border p-3 sm:p-4', tone.box)}>
                <h2 id={`now-h-${g.id}`} className={classNames('mb-1 flex items-center gap-2 text-base font-semibold sm:text-lg', tone.head)}>
                  <Icon size={17} aria-hidden className="shrink-0" /> {meta.title} <span className="font-normal opacity-90">({g.items.length})</span>
                </h2>
                <ul className="divide-y divide-white/70">
                  {shown.map((it) => {
                    const ItemIcon = ICONS[it.icon]
                    const body = (
                      <>
                        <span aria-hidden className="mt-0.5 shrink-0 text-brand-600">
                          <ItemIcon size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span dir="auto" className="line-clamp-2 block break-words text-sm font-medium text-slate-800">
                            {it.title}
                          </span>
                          {it.sub && (
                            <span dir="auto" className="line-clamp-2 block break-words text-xs text-slate-600">
                              {it.sub}
                            </span>
                          )}
                        </span>
                        {it.when && <span className={classNames('chip shrink-0', tone.chip)}>{it.when}</span>}
                      </>
                    )
                    return (
                      <li key={it.key}>
                        {it.to ? (
                          <Link to={it.to} className="flex min-h-[48px] items-start gap-2 rounded-xl px-1.5 py-2.5 transition hover:bg-white/70">
                            {body}
                          </Link>
                        ) : (
                          <div className="flex min-h-[48px] items-start gap-2 px-1.5 py-2.5">{body}</div>
                        )}
                      </li>
                    )
                  })}
                </ul>
                {g.items.length > LIMIT && (
                  <button type="button" className="btn-ghost mt-1 w-full text-sm" aria-expanded={shown.length > LIMIT} onClick={() => setShownCount((e) => ({ ...e, [g.id]: all ? LIMIT : Math.min(g.items.length, count + STEP) }))}>
                    {all ? 'הצג פחות' : `הצג עוד ${Math.min(STEP, g.items.length - count)}${g.items.length - count > STEP ? ` · נשארו ${g.items.length - count}` : ''}`}
                  </button>
                )}
              </section>
            )
          })}
        </>
      )}
    </div>
  )
}
