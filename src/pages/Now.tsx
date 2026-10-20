import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, CalendarDays, CheckCircle2, CheckSquare, DatabaseBackup, FileUp, ScanLine, Stethoscope, Sun, Swords, Target } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { useCompetitorIntel, useDoctors, useFavorites, useMeetings, useMyHospitalIds, usePatientScans, useTasks } from '../lib/api'
import { competitorAlerts, newActivity } from '../lib/competitors'
import { contactState } from '../lib/cadence'
import { rescanAlert, weekMissing } from '../lib/scanAlerts'
import { SCAN_PROCEDURE_LABELS } from '../lib/types'
import { classNames, daysUntil, formatDate, plusDaysISO, todayISO } from '../lib/utils'
import { Spinner } from '../components/ui'
import { useStageHistoryAll, useStuckThresholds } from '../lib/pipeline'
import { useUploadRequests } from '../lib/largeFiles'
import { useAppSetting } from '../lib/api'
import { stageSinceMap, stuckPotentials } from '../lib/pipelineStats'

type Item = { key: string; to: string; icon: React.ReactNode; title: string; sub: string; when: string }
type Group = { id: string; title: string; tone: 'red' | 'amber' | 'blue'; icon: LucideIcon; items: Item[] }
const LIMIT = 8
/** short names of the groups for the jump strip */
const SHORT: Record<string, string> = { late: 'באיחור', today: 'היום', soon: 'השבוע', contact: 'לחזור לרופאים', backup: 'גיבוי', uploads: 'קבצים גדולים', pipeline: 'פוטנציאליים', competitors: 'מתחרים' }

const TONE = {
  red: { box: 'border-red-200 bg-red-50/60', head: 'text-red-700', chip: 'border-red-200 bg-white text-red-600' },
  amber: { box: 'border-amber-200 bg-amber-50/50', head: 'text-amber-800', chip: 'border-amber-200 bg-white text-amber-700' },
  blue: { box: 'border-brand-100 bg-brand-50/50', head: 'text-brand-800', chip: 'border-brand-200 bg-white text-brand-700' },
}

/** everything that needs me, in one list ordered by urgency: late first, then today, then the coming days */
export default function Now() {
  const { user } = useAuth()
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
  const backupSetting = useAppSetting('backup.last')
  const { isAdmin } = useAuth()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const loading = [tasks, meetings, scans, doctors].some((q) => q.isLoading)

  const groups = useMemo(() => {
    const t = todayISO()
    const week = plusDaysISO(7)
    const mine = (m: { responsible_agent_id: string | null; meeting_agents: { agent: { id: string } | null }[] }) =>
      !m.responsible_agent_id || m.responsible_agent_id === user?.id || m.meeting_agents.some((a) => a.agent?.id === user?.id)
    const myTasks = (tasks.data ?? []).filter((x) => !x.is_done && x.status !== 'done' && x.assignee_id === user?.id)
    const openMeetings = (meetings.data ?? []).filter((m) => m.meeting_date && m.status === 'scheduled' && mine(m))
    const activeScans = (scans.data ?? []).filter((s) => s.status !== 'cancelled')

    const taskItem = (x: (typeof myTasks)[number]): Item => ({
      key: `t${x.id}`,
      to: '/tasks',
      icon: <CheckSquare size={16} />,
      title: x.description,
      sub: [x.doctor?.name, x.hospital?.name, x.priority === 'urgent' ? 'דחוף' : ''].filter(Boolean).join(' · '),
      when: x.due_date ? formatDate(x.due_date) : '',
    })
    const meetingItem = (m: (typeof openMeetings)[number]): Item => ({
      key: `m${m.id}`,
      to: `/meetings/${m.id}`,
      icon: <CalendarDays size={16} />,
      title: m.subject || 'פגישה',
      sub: [m.meeting_doctors.flatMap((d) => (d.doctor ? [d.doctor.name] : [])).join(', '), m.hospital?.name].filter(Boolean).join(' · '),
      when: `${formatDate(m.meeting_date)}${m.meeting_time ? ` ${m.meeting_time.slice(0, 5)}` : ''}`,
    })
    const scanItem = (s: (typeof activeScans)[number], what: string): Item => ({
      key: `s${s.id}-${what}`,
      to: '/scans',
      icon: <ScanLine size={16} />,
      title: `${s.patient_name || 'מטופל'} · ${SCAN_PROCEDURE_LABELS[s.procedure_type] ?? s.procedure_type}`,
      sub: [what, s.hospital?.name].filter(Boolean).join(' · '),
      when: s.surgery_date ? `ניתוח ${formatDate(s.surgery_date)}` : s.ct_date ? `CT ${formatDate(s.ct_date)}` : '',
    })

    const late: Item[] = [
      ...myTasks.filter((x) => x.due_date && x.due_date < t).sort((a, b) => a.due_date!.localeCompare(b.due_date!)).map(taskItem),
      ...openMeetings.filter((m) => m.meeting_date! < t).sort((a, b) => a.meeting_date!.localeCompare(b.meeting_date!)).map((m) => ({ ...meetingItem(m), sub: `עבר המועד — עדכן סיכום או קבע מחדש · ${meetingItem(m).sub}` })),
      ...activeScans.filter((s) => s.ct_date && s.ct_date < t && !s.scanned).map((s) => scanItem(s, 'CT עבר ולא נסרק')),
    ]
    const today: Item[] = [
      ...myTasks.filter((x) => x.due_date === t).map(taskItem),
      ...openMeetings.filter((m) => m.meeting_date === t).map(meetingItem),
      ...activeScans.filter((s) => s.ct_date === t && !s.scanned).map((s) => scanItem(s, 'CT היום')),
      ...activeScans.filter((s) => s.surgery_date === t).map((s) => scanItem(s, 'ניתוח היום')),
    ]
    const soon: Item[] = [
      ...activeScans.filter((s) => s.surgery_date && s.surgery_date > t && s.surgery_date <= week && !s.ct_date).map((s) => scanItem(s, 'ניתוח השבוע — אין תאריך CT')),
      ...activeScans.filter((s) => s.surgery_date && s.surgery_date >= t && s.surgery_date <= week && s.ct_date && !s.disk_collected).map((s) => scanItem(s, 'ניתוח השבוע — הדיסק לא הועלה')),
      ...activeScans.filter((s) => s.ct_date && s.ct_date > t && (daysUntil(s.ct_date) ?? 99) <= 7 && weekMissing(s).length > 0).map((s) => scanItem(s, `CT בשבוע הקרוב — ${weekMissing(s).join(', ')}`)),
      ...activeScans.flatMap((s) => {
        const k = rescanAlert(s)
        return k === 'today' || k === 'overdue' ? [scanItem(s, k === 'today' ? 'סריקה חוזרת היום' : 'סריקה חוזרת באיחור')] : []
      }),
      ...openMeetings.filter((m) => m.meeting_date! > t && m.meeting_date! <= week).sort((a, b) => a.meeting_date!.localeCompare(b.meeting_date!)).map(meetingItem),
      ...myTasks.filter((x) => x.due_date && x.due_date > t && x.due_date <= week).sort((a, b) => a.due_date!.localeCompare(b.due_date!)).map(taskItem),
    ]
    const fav = new Set(favorites.data ?? [])
    const toContact: Item[] = (doctors.data ?? [])
      .filter((d) => fav.has(d.id) && d.contact_cadence_days)
      .map((d) => ({ d, st: contactState(d, meetings.data ?? []) }))
      .filter((x) => x.st.status === 'due' || x.st.status === 'soon')
      .map(({ d, st }) => ({
        key: `c${d.id}`,
        to: `/doctors/${d.id}`,
        icon: <Stethoscope size={16} />,
        title: `${d.title} ${d.name}`.trim(),
        sub: st.lastDate ? `קשר אחרון ${formatDate(st.lastDate)}` : 'אין פגישה מתועדת',
        when: st.status === 'due' ? `באיחור ${Math.abs(daysUntil(st.dueDate) ?? 0)} ימים` : `בעוד ${st.daysToDue} ימים`,
      }))

    // opportunities against competitors: a contract or tender ending soon, and what was recorded this week at my hospitals
    const scope = isAdmin ? null : myHospitals
    const intel = competitorIntel.data ?? []
    const opportunities: Item[] = [
      ...competitorAlerts(intel, scope, 60).map((a) => ({
        key: `k${a.key}`,
        to: '/competitors?tab=contracts',
        icon: <Swords size={16} />,
        title: `${a.kind === 'contract' ? 'סיום חוזה' : `מכרז ${a.intel.tender_name}`} · ${a.intel.competitor}`,
        sub: [a.intel.hospital?.name, a.intel.doctor?.name].filter(Boolean).join(' · '),
        when: a.days === 0 ? 'היום' : `בעוד ${a.days} ימים`,
      })),
      ...newActivity(intel, scope, user?.id).slice(0, 5).map((i) => ({
        key: `n${i.id}`,
        to: '/competitors',
        icon: <Swords size={16} />,
        title: `פעילות חדשה של ${i.competitor}${i.product ? ` (${i.product})` : ''}`,
        sub: [i.hospital?.name, i.doctor?.name].filter(Boolean).join(' · '),
        when: formatDate(i.intel_date),
      })),
    ]

    // potential doctors that need a push: no stage or next step, a late next step, too long in one stage
    const myDoctors = (doctors.data ?? []).filter((d) => isAdmin || d.created_by === user?.id || d.doctor_hospitals.some((h) => (myHospitals ?? []).includes(h.hospital_id)))
    const stuck: Item[] = stuckPotentials(myDoctors, stageSinceMap(stageHistory.data ?? []), stuckThresholds).map(({ d, reasons }) => ({
      key: `p${d.id}`,
      to: `/doctors/${d.id}`,
      icon: <Target size={16} />,
      title: `${d.title} ${d.name}`.trim(),
      sub: [d.pipeline_stage || 'ללא שלב', ...reasons.map((r) => r.label)].join(' · '),
      when: d.next_step_date ? formatDate(d.next_step_date) : '',
    }))

    // large files: the managers' requests to decide, and the answers to my own
    const reqs = uploads.data ?? []
    const mb = (n: number) => `${(n / 1024 / 1024).toFixed(0)}MB`
    const uploadItems: Item[] = [
      ...(isAdmin ? reqs.filter((r) => r.status === 'pending').map((r) => ({ key: `u${r.id}`, to: '/settings?tab=uploads', icon: <FileUp size={16} />, title: `בקשה להעלאת קובץ גדול: ${r.file_name}`, sub: [mb(r.file_size), r.purpose, r.requester?.full_name].filter(Boolean).join(' · '), when: formatDate(r.created_at.slice(0, 10)) })) : []),
      ...reqs.filter((r) => r.requested_by === user?.id && r.status === 'approved').map((r) => ({ key: `ua${r.id}`, to: '/now', icon: <FileUp size={16} />, title: `אושר — אפשר להעלות את ${r.file_name}`, sub: `${mb(r.file_size)} · בחר את הקובץ שוב באותו מקום והעלה`, when: '' })),
      ...reqs.filter((r) => r.requested_by === user?.id && r.status === 'rejected' && (daysUntil(r.decided_at?.slice(0, 10) ?? null) ?? -99) >= -7).map((r) => ({ key: `ur${r.id}`, to: '/now', icon: <FileUp size={16} />, title: `נדחתה ההעלאה של ${r.file_name}`, sub: r.decision_note || 'אפשר לפנות למנהל או להקטין את הקובץ', when: '' })),
    ]

    // managers: a reminder when the manual backup is old (the free plan has no automatic one)
    const lastBackup = backupSetting.data ? backupSetting.data.slice(0, 10) : ''
    const backupDays = lastBackup ? -(daysUntil(lastBackup) ?? 0) : null
    const backupItems: Item[] = isAdmin && !backupSetting.isLoading && (backupDays === null || backupDays > 7)
      ? [{ key: 'backup', to: '/users?tab=backup', icon: <DatabaseBackup size={16} />, title: backupDays === null ? 'עוד לא נעשה גיבוי של הנתונים' : `הגיבוי האחרון לפני ${backupDays} ימים`, sub: 'אין גיבוי אוטומטי בתוכנית החינמית — כדאי להוריד גיבוי אחת לשבוע', when: lastBackup ? formatDate(lastBackup) : '' }]
      : []

    const out: Group[] = [
      { id: 'late', title: 'באיחור — לטפל קודם', tone: 'red', icon: AlertTriangle, items: late },
      { id: 'today', title: 'היום', tone: 'amber', icon: Sun, items: today },
      { id: 'soon', title: 'השבוע הקרוב', tone: 'blue', icon: CalendarDays, items: soon },
      { id: 'contact', title: 'רופאים לחזור אליהם', tone: 'blue', icon: Stethoscope, items: toContact },
      { id: 'backup', title: 'גיבוי נתונים', tone: 'amber', icon: DatabaseBackup, items: backupItems },
      { id: 'uploads', title: 'קבצים גדולים — אישורי העלאה', tone: 'amber', icon: FileUp, items: uploadItems },
      { id: 'pipeline', title: 'רופאים פוטנציאליים שדורשים דחיפה', tone: 'amber', icon: Target, items: stuck },
      { id: 'competitors', title: 'הזדמנויות מול מתחרים', tone: 'amber', icon: Swords, items: opportunities },
    ]
    return out.filter((g) => g.items.length > 0)
  }, [tasks.data, meetings.data, scans.data, doctors.data, favorites.data, competitorIntel.data, stageHistory.data, stuckThresholds, uploads.data, backupSetting.data, backupSetting.isLoading, myHospitals, isAdmin, user?.id])

  const total = groups.reduce((n, g) => n + g.items.length, 0)

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-brand-800 sm:text-3xl">
          <AlertTriangle className="shrink-0 text-accent" size={26} aria-hidden />
          דחוף עכשיו
        </h1>
        <p className="text-sm text-slate-600">
          {loading || total === 0 ? 'מה שדורש אותך, בסדר דחיפות' : `${total} דברים מחכים לך, לפי סדר דחיפות`}
        </p>
      </div>
      {loading ? (
        <Spinner />
      ) : total === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <CheckCircle2 size={40} aria-hidden className="text-emerald-500" />
          <p className="text-lg font-semibold text-brand-800">הכול מטופל</p>
          <p className="text-sm text-slate-600">אין עכשיו משהו שמחכה לך.</p>
        </div>
      ) : (
        <>
          {groups.length > 1 && (
            <nav aria-label="קפיצה לקבוצה" className="flex flex-wrap gap-2">
              {groups.map((g) => (
                <a key={g.id} href={`#now-${g.id}`} className={classNames('chip', TONE[g.tone].chip)}>
                  {SHORT[g.id] ?? g.title} <span className="font-semibold">{g.items.length}</span>
                </a>
              ))}
            </nav>
          )}
          {groups.map((g) => {
            const open = !!expanded[g.id]
            const shown = open ? g.items : g.items.slice(0, LIMIT)
            const Icon = g.icon
            return (
              <section key={g.id} id={`now-${g.id}`} aria-labelledby={`now-h-${g.id}`} className={classNames('scroll-mt-20 rounded-2xl border p-3 sm:p-4', TONE[g.tone].box)}>
                <h2 id={`now-h-${g.id}`} className={classNames('mb-1 flex items-center gap-2 text-base font-semibold sm:text-lg', TONE[g.tone].head)}>
                  <Icon size={17} aria-hidden className="shrink-0" /> {g.title} <span className="font-normal opacity-90">({g.items.length})</span>
                </h2>
                <ul className="divide-y divide-white/70">
                  {shown.map((it) => (
                    <li key={it.key}>
                      <Link to={it.to} className="flex min-h-[48px] items-start gap-2 rounded-xl px-1.5 py-2.5 transition hover:bg-white/70">
                        <span aria-hidden className="mt-0.5 shrink-0 text-brand-600">{it.icon}</span>
                        <span className="min-w-0 flex-1">
                          <span dir="auto" className="line-clamp-2 break-words text-sm font-medium text-slate-800">
                            {it.title}
                          </span>
                          {it.sub && (
                            <span dir="auto" className="line-clamp-2 break-words text-xs text-slate-600">
                              {it.sub}
                            </span>
                          )}
                        </span>
                        {it.when && <span className={classNames('chip shrink-0', TONE[g.tone].chip)}>{it.when}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
                {g.items.length > LIMIT && (
                  <button className="btn-ghost mt-1 w-full text-sm" aria-expanded={open} onClick={() => setExpanded((e) => ({ ...e, [g.id]: !open }))}>
                    {open ? 'הצג פחות' : `הצג עוד ${g.items.length - LIMIT}`}
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
