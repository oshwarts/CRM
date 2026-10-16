import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarDays, CheckCircle2, CheckSquare, Clock, ScanLine, Stethoscope, Swords, Target } from 'lucide-react'
import { useAuth } from '../context/AuthProvider'
import { useCompetitorIntel, useDoctors, useFavorites, useMeetings, useMyHospitalIds, usePatientScans, useTasks } from '../lib/api'
import { competitorAlerts, newActivity } from '../lib/competitors'
import { contactState } from '../lib/cadence'
import { rescanAlert, weekMissing } from '../lib/scanAlerts'
import { SCAN_PROCEDURE_LABELS } from '../lib/types'
import { classNames, daysUntil, formatDate, plusDaysISO, todayISO } from '../lib/utils'
import { Spinner } from '../components/ui'
import { useStageHistoryAll } from '../lib/pipeline'
import { stageSinceMap, stuckPotentials } from '../lib/pipelineStats'

type Item = { key: string; to: string; icon: React.ReactNode; title: string; sub: string; when: string }
type Group = { id: string; title: string; tone: 'red' | 'amber' | 'blue'; items: Item[] }

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
  const { isAdmin } = useAuth()
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
      sub: [s.hospital?.name, what].filter(Boolean).join(' · '),
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
    const stuck: Item[] = stuckPotentials(myDoctors, stageSinceMap(stageHistory.data ?? [])).map(({ d, reasons }) => ({
      key: `p${d.id}`,
      to: `/doctors/${d.id}`,
      icon: <Target size={16} />,
      title: `${d.title} ${d.name}`.trim(),
      sub: [d.pipeline_stage || 'ללא שלב', ...reasons.map((r) => r.label)].join(' · '),
      when: d.next_step_date ? formatDate(d.next_step_date) : '',
    }))

    const out: Group[] = [
      { id: 'late', title: 'באיחור — לטפל קודם', tone: 'red', items: late },
      { id: 'today', title: 'היום', tone: 'amber', items: today },
      { id: 'soon', title: 'השבוע הקרוב', tone: 'blue', items: soon },
      { id: 'contact', title: 'רופאים לחזור אליהם', tone: 'blue', items: toContact },
      { id: 'pipeline', title: 'רופאים פוטנציאליים שדורשים דחיפה', tone: 'amber', items: stuck },
      { id: 'competitors', title: 'הזדמנויות מול מתחרים', tone: 'amber', items: opportunities },
    ]
    return out.filter((g) => g.items.length > 0)
  }, [tasks.data, meetings.data, scans.data, doctors.data, favorites.data, competitorIntel.data, stageHistory.data, myHospitals, isAdmin, user?.id])

  const total = groups.reduce((n, g) => n + g.items.length, 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-brand-800 sm:text-3xl">
          <AlertTriangle className="text-accent" size={26} />
          דחוף עכשיו
        </h1>
        <p className="text-sm text-slate-500">כל מה שדורש אותך, בסדר דחיפות: משימות, פגישות, סריקות וקשר עם רופאים</p>
      </div>
      {loading ? (
        <Spinner />
      ) : total === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <CheckCircle2 size={40} className="text-emerald-500" />
          <p className="text-lg font-semibold text-brand-800">הכול מטופל</p>
          <p className="text-sm text-slate-500">אין עכשיו משהו שמחכה לך.</p>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.id} className={classNames('rounded-2xl border p-4', TONE[g.tone].box)}>
            <h2 className={classNames('mb-2 flex items-center gap-2 text-lg font-semibold', TONE[g.tone].head)}>
              <Clock size={17} /> {g.title} <span className="font-normal opacity-70">({g.items.length})</span>
            </h2>
            <ul className="divide-y divide-white/70">
              {g.items.map((it) => (
                <li key={it.key}>
                  <Link to={it.to} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-2 py-2.5 transition hover:bg-white/70">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-brand-600 shadow-sm">{it.icon}</span>
                    <span className="min-w-[8rem] flex-1">
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
          </section>
        ))
      )}
    </div>
  )
}
