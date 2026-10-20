import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Building2, CalendarDays, ChevronLeft, ChevronRight, Plus, Printer, Scissors, Trash2 } from 'lucide-react'
import { useAgents } from '../lib/api'
import {
  useAddAgentNote,
  useAgentGoals,
  useAgentNotes,
  useAgentReviews,
  useDeleteAgentNote,
  useDeleteReview,
  useMetricData,
} from '../lib/agentsApi'
import { useProjects } from '../lib/projectsApi'
import { projectStats } from '../lib/projects'
import { AUTO_METRICS, agentMeetings, computeAgentMetrics, goalProgress, monthPeriod, overlaps, quarterPeriod, weekRange, type Period } from '../lib/agentMetrics'
import { SCAN_PROCEDURE_LABELS } from '../lib/types'
import type { AgentGoal, AgentReview, TaskRow } from '../lib/types'
import { useAuth } from '../context/AuthProvider'
import { GoalFormModal } from '../components/GoalFormModal'
import { GoalBars } from '../components/GoalBars'
import { TrainingPanel } from '../components/TrainingPanel'
import { LearnSummary } from '../components/LearnSummary'
import { REVIEW_KINDS, ReviewFormModal } from '../components/ReviewFormModal'
import { TaskFormModal } from '../components/TaskFormModal'
import { ConfirmButton, EmptyState, Field, Spinner, Tab, TabList, TabPanel, Tabs } from '../components/ui'
import { PeriodControls } from '../components/team/PeriodControls'
import { classNames, formatDate, formatTime, todayISO } from '../lib/utils'

const dayName = (d: string) => new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' }).format(new Date(`${d}T12:00:00`))

function Kpi({ label, value, bad, hint }: { label: string; value: string | number | null; bad?: boolean; hint?: string }) {
  return (
    <div className="card p-3">
      <p className={classNames('text-2xl font-bold leading-tight', bad ? 'text-red-600' : 'text-slate-800')}>{value ?? '—'}</p>
      <p className="text-sm text-slate-600">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

/** a title for a block of the page with its action next to it */
function SectionHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-lg font-semibold text-brand-800">{title}</h2>
      {children}
    </div>
  )
}

export default function AgentView() {
  const { id } = useParams<{ id: string }>()
  const { isAdmin } = useAuth()
  const agents = useAgents()
  const { data, loading } = useMetricData()
  const goals = useAgentGoals()
  const projects = useProjects()
  const reviews = useAgentReviews(id)
  const notes = useAgentNotes(id)
  const addNote = useAddAgentNote()
  const delNote = useDeleteAgentNote()
  const delReview = useDeleteReview()

  const [tab, setTab] = useState('overview')
  const [kind, setKind] = useState<'month' | 'quarter'>('month')
  const [offset, setOffset] = useState(0)
  const [week, setWeek] = useState(0)
  const [goalModal, setGoalModal] = useState<{ goal?: AgentGoal } | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [openReview, setOpenReview] = useState<string | null>(null)

  const agent = (agents.data ?? []).find((a) => a.id === id)
  const period: Period = kind === 'month' ? monthPeriod(offset) : quarterPeriod(offset)
  const metrics = useMemo(() => (data && id ? computeAgentMetrics(id, period, data) : null), [data, id, kind, offset]) // eslint-disable-line react-hooks/exhaustive-deps
  const myGoals = (goals.data ?? []).filter((g) => g.agent_id === id && overlaps(g, period))
  const myTasks = useMemo(() => (data?.tasks ?? []).filter((t) => t.assignee_id === id), [data, id])
  const today = todayISO()

  if (!isAdmin) return <EmptyState title="אין הרשאה" hint="העמוד זמין למנהלים בלבד" />
  if (agents.isLoading || loading) return <Spinner />
  if (!agent || !id) return <EmptyState title="הסוכן לא נמצא" />

  /* ---- schedule of the chosen week ---- */
  const wk = weekRange(week)
  const hospitalIds = new Set(data?.hospitalsOf.get(id) ?? [])
  const weekMeetings = agentMeetings(id, data?.meetings ?? []).filter((m) => m.status !== 'cancelled' && m.meeting_date && m.meeting_date >= wk.start && m.meeting_date <= wk.end)
  const weekSurgeries = (data?.scans ?? []).filter((s) => s.status !== 'cancelled' && s.surgery_date && s.surgery_date >= wk.start && s.surgery_date <= wk.end && hospitalIds.has(s.hospital_id))

  const open = myTasks.filter((t) => t.status !== 'done')
  const overdue = open.filter((t) => t.due_date && t.due_date < today)
  const blocked = open.filter((t) => t.status === 'blocked')
  const rest = open.filter((t) => !overdue.includes(t) && !blocked.includes(t))
  const otherGoals = (goals.data ?? []).filter((g) => g.agent_id === id && !overlaps(g, period))
  const periodReviews = (reviews.data ?? []).filter((r) => r.review_date >= period.start && r.review_date <= period.end)
  const ownedProjects = (projects.data ?? []).filter((p) => p.owner_id === id && p.status === 'active')

  const taskRow = (t: TaskRow) => (
    <li key={t.id} className="py-2.5 text-sm">
      <p dir="auto" className="text-slate-800">
        {t.description}
      </p>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
        {t.project && (
          <Link to={`/projects/${t.project.id}`} className="text-violet-700 hover:underline">
            פרויקט: {t.project.name}
          </Link>
        )}
        {t.status === 'blocked' && <span className="font-medium text-red-600">תקוע</span>}
        {t.waiting_for && <span className="text-amber-700">ממתין ל: {t.waiting_for}</span>}
        {t.due_date && <span className={classNames(t.due_date < today ? 'font-medium text-red-600' : 'text-slate-500')}>{t.due_date < today ? 'באיחור · ' : 'עד '}{formatDate(t.due_date)}</span>}
      </p>
    </li>
  )

  const periodControls = (
    <PeriodControls
      kind={kind}
      label={period.label}
      onKind={(k) => {
        setKind(k)
        setOffset(0)
      }}
      onPrev={() => setOffset((o) => o - 1)}
      onNext={() => setOffset((o) => o + 1)}
      onToday={offset !== 0 ? () => setOffset(0) : undefined}
    />
  )
  const name = agent.full_name || agent.email
  const needs = (metrics?.tasks_overdue ?? 0) + (metrics?.tasks_blocked ?? 0) + (metrics?.cadence_due ?? 0)

  return (
    <div className="space-y-4">
      <Link to="/agents" className="inline-flex min-h-9 items-center gap-1 text-sm text-slate-600 hover:text-slate-800">
        <ArrowRight size={15} />
        כל הסוכנים
      </Link>
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#00326d] text-lg font-semibold text-white">
          {(name.trim()[0] ?? '?').toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold leading-tight text-brand-800 sm:text-3xl">{name}</h1>
          <p dir="ltr" className="truncate text-right text-sm text-slate-500">
            {agent.email}
          </p>
        </div>
      </div>
      {tab !== 'work' && periodControls}

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab id="overview">סקירה</Tab>
          <Tab id="work">לוז ומשימות</Tab>
          <Tab id="plan">יעדים והכשרה</Tab>
          <Tab id="talks">שיחות והערכה</Tab>
        </TabList>

        {/* ---------- overview ---------- */}
        <TabPanel id="overview">
          <div className="space-y-4">
            {needs > 0 && (
              <section className={classNames('card p-3', (metrics?.tasks_overdue ?? 0) >= 3 || (metrics?.cadence_due ?? 0) >= 5 ? 'border-red-200' : 'border-amber-200')}>
                <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
                  <AlertTriangle size={17} className="text-amber-600" aria-hidden /> דורש תשומת לב
                </h2>
                <ul className="space-y-0.5 text-sm">
                  {(metrics?.tasks_overdue ?? 0) > 0 && <li className="text-red-700">● {metrics?.tasks_overdue === 1 ? 'משימה אחת באיחור' : `${metrics?.tasks_overdue} משימות באיחור`}</li>}
                  {(metrics?.tasks_blocked ?? 0) > 0 && <li className="text-amber-700">● {metrics?.tasks_blocked === 1 ? 'משימה אחת תקועה' : `${metrics?.tasks_blocked} משימות תקועות`}</li>}
                  {(metrics?.cadence_due ?? 0) > 0 && <li className="text-amber-700">● {metrics?.cadence_due === 1 ? 'רופא אחד באיחור קשר' : `${metrics?.cadence_due} רופאים באיחור קשר`}</li>}
                </ul>
                {((metrics?.tasks_overdue ?? 0) > 0 || (metrics?.tasks_blocked ?? 0) > 0) && (
                  <button type="button" className="mt-1 inline-flex min-h-9 items-center text-sm font-medium text-brand-700 hover:underline" onClick={() => setTab('work')}>
                    למשימות של {name}
                  </button>
                )}
              </section>
            )}
            <section aria-label="מדדי התקופה" className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Kpi label="פגישות שהתקיימו" value={metrics?.meetings_held ?? null} />
              <Kpi label="ניתוחים בבתי החולים" value={metrics?.surgeries_covered ?? null} />
              <Kpi
                label="משימות פתוחות"
                value={metrics?.tasks_open ?? null}
                hint={`${metrics?.tasks_done ?? 0} הושלמו בתקופה${(metrics?.tasks_overdue ?? 0) > 0 ? ` · ${metrics?.tasks_overdue} באיחור` : ''}`}
              />
              <Kpi label="רופאים באיחור קשר" value={metrics?.cadence_due ?? null} bad={(metrics?.cadence_due ?? 0) > 0} hint={metrics?.cadence_ok_pct != null ? `${metrics.cadence_ok_pct}% בקצב תקין` : 'לא הוגדר קצב קשר'} />
              <Kpi label="סריקות שנוספו" value={metrics?.scans_created ?? null} />
              <Kpi label="ספירות מתכלים" value={metrics?.consumable_counts ?? null} />
            </section>
            <section className="card p-4">
              <SectionHead title={`יעדים — ${period.label}`}>
                <button className="btn-secondary !px-4" onClick={() => setGoalModal({})}>
                  <Plus size={15} /> יעד
                </button>
              </SectionHead>
              <GoalBars goals={myGoals} data={data} onEdit={(g) => setGoalModal({ goal: g })} empty="אין יעדים לתקופה. הוסף יעד כדי לעקוב אחרי ההתקדמות." />
            </section>
          </div>
        </TabPanel>

        {/* ---------- weekly schedule ---------- */}
        <TabPanel id="work">
          <SectionHead title="לוז שבועי" />
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center justify-between rounded-full border border-slate-200 bg-white px-0.5 sm:max-w-sm">
                <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-600 hover:bg-brand-50" onClick={() => setWeek((w) => w - 1)} aria-label="שבוע קודם">
                  <ChevronRight size={18} />
                </button>
                <span aria-live="polite" className="truncate px-1 text-sm font-semibold text-slate-800">
                  {formatDate(wk.start)} – {formatDate(wk.end)}
                </span>
                <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-600 hover:bg-brand-50" onClick={() => setWeek((w) => w + 1)} aria-label="שבוע הבא">
                  <ChevronLeft size={18} />
                </button>
              </div>
              {week !== 0 && (
                <button type="button" className="min-h-9 rounded-full px-3 text-sm font-medium text-brand-700 hover:bg-brand-50" onClick={() => setWeek(0)}>
                  השבוע
                </button>
              )}
            </div>
            <p className="text-sm text-slate-600">
              {weekMeetings.length} פגישות · {weekSurgeries.length} ניתוחים בבתי החולים שלו
            </p>
            <div className="space-y-2">
              {wk.days.map((d) => {
                const ms = weekMeetings.filter((m) => m.meeting_date === d).sort((a, b) => (a.meeting_time ?? '').localeCompare(b.meeting_time ?? ''))
                const ss = weekSurgeries.filter((s) => s.surgery_date === d)
                if (ms.length + ss.length === 0)
                  return (
                    <p key={d} className={classNames('flex items-center justify-between px-3 py-1 text-sm text-slate-500', d === today && 'font-semibold text-brand-700')}>
                      <span>{dayName(d)}</span>
                      <span className="text-xs">פנוי</span>
                    </p>
                  )
                return (
                  <section key={d} className={classNames('card p-3', d === today && 'border-brand-300')}>
                    <h3 className="mb-1 text-sm font-semibold text-slate-800">
                      {dayName(d)}
                      {d === today && <span className="mr-2 text-xs font-medium text-brand-700">היום</span>}
                    </h3>
                    {ms.length > 0 && (
                      <ul className="divide-y divide-slate-100">
                        {ms.map((m) => (
                          <li key={m.id}>
                            <Link to={`/meetings/${m.id}`} className="flex items-start gap-2 py-2 text-sm hover:bg-slate-50">
                              <CalendarDays size={15} className="mt-0.5 shrink-0 text-brand-500" aria-hidden />
                              <span className="min-w-0 flex-1">
                                <span className="block font-medium text-slate-800">
                                  {m.meeting_time ? <span className="ml-2 text-xs font-normal text-slate-500">{formatTime(m.meeting_time)}</span> : null}
                                  {m.subject || 'פגישה'}
                                </span>
                                <span className="block text-xs text-slate-600">{[m.meeting_doctors.flatMap((x) => (x.doctor ? [x.doctor.name] : [])).join(', '), m.hospital?.name].filter(Boolean).join(' · ')}</span>
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                    {ss.length > 0 && (
                      <ul className="divide-y divide-slate-100">
                        {ss.map((s) => (
                          <li key={s.id} className="flex items-start gap-2 py-2 text-sm">
                            <Scissors size={15} className="mt-0.5 shrink-0 text-red-500" aria-hidden />
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium text-slate-800">
                                {SCAN_PROCEDURE_LABELS[s.procedure_type] ?? s.procedure_type} {s.side}
                              </span>
                              <span className="block text-xs text-slate-600">{[s.hospital?.name, s.surgeon ? `${s.surgeon.title} ${s.surgeon.name}` : ''].filter(Boolean).join(' · ')}</span>
                              {!s.plan_ready && <span className="text-xs font-medium text-amber-700">תוכנית לא מוכנה</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )
              })}
            </div>
            {hospitalIds.size === 0 && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <Building2 size={14} className="mt-0.5 shrink-0" aria-hidden /> לא שויכו לסוכן בתי חולים (בהגדרות ← בתי חולים), ולכן ניתוחים לא מוצגים בלוז שלו.
              </p>
            )}
          </div>

          <div className="mt-8 border-t border-slate-200 pt-5">
            <SectionHead title="משימות ופרויקטים">
              <button className="btn-primary !px-4" onClick={() => setAssigning(true)}>
                <Plus size={16} /> הקצה משימה
              </button>
            </SectionHead>
            <div className="space-y-3">
              {[
                { title: `באיחור (${overdue.length})`, list: overdue, tone: 'text-red-700' },
                { title: `תקועות (${blocked.length})`, list: blocked, tone: 'text-red-700' },
                { title: `שאר המשימות הפתוחות (${rest.length})`, list: rest, tone: 'text-slate-800' },
              ]
                .filter((g) => g.list.length > 0)
                .map((g) => (
                  <section key={g.title} className="card p-4">
                    <h3 className={classNames('mb-1 font-semibold', g.tone)}>{g.title}</h3>
                    <ul className="divide-y divide-slate-100">{g.list.map(taskRow)}</ul>
                  </section>
                ))}
              {open.length === 0 && <p className="card p-4 text-sm text-slate-600">אין משימות פתוחות.</p>}
              <section className="card p-4">
                <h3 className="mb-1 font-semibold text-brand-800">פרויקטים באחריותו ({ownedProjects.length})</h3>
                {ownedProjects.length === 0 ? (
                  <p className="text-sm text-slate-600">אין פרויקטים פעילים.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {ownedProjects.map((p) => {
                      const st = projectStats((data?.tasks ?? []).filter((t) => t.project_id === p.id))
                      return (
                        <li key={p.id}>
                          <Link to={`/projects/${p.id}`} className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-2 text-sm hover:bg-slate-50">
                            <span dir="auto" className="min-w-0 font-medium text-slate-800">
                              {p.name}
                            </span>
                            <span className="flex items-center gap-3 text-xs">
                              {st.blocked.length > 0 && <span className="text-red-700">{st.blocked.length} תקועות</span>}
                              {st.overdue.length > 0 && <span className="text-amber-700">{st.overdue.length} באיחור</span>}
                              <span className="text-slate-600">{st.percent}%</span>
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </TabPanel>

        {/* ---------- goals ---------- */}
        <TabPanel id="plan">
          <SectionHead title="יעדים">
            <button className="btn-primary !px-4" onClick={() => setGoalModal({})}>
              <Plus size={16} /> יעד חדש
            </button>
          </SectionHead>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">יעדים שחופפים ל-{period.label}. הסוכן רואה את היעדים וההתקדמות שלו בדף הבית.</p>
            <div className="card p-4">
              <GoalBars goals={myGoals} data={data} onEdit={(g) => setGoalModal({ goal: g })} />
            </div>
            {otherGoals.length > 0 && (
              <details className="card p-4">
                <summary className="flex min-h-9 cursor-pointer items-center text-sm font-medium text-slate-700">יעדים מתקופות אחרות ({otherGoals.length})</summary>
                <div className="mt-3">
                  <GoalBars goals={otherGoals} data={data} onEdit={(g) => setGoalModal({ goal: g })} />
                </div>
              </details>
            )}
          </div>
          <div className="mt-8 border-t border-slate-200 pt-5">
            <SectionHead title="הכשרות" />
            <TrainingPanel agentId={id} />
            <div className="mt-3">
              <LearnSummary agentId={id} />
            </div>
          </div>
        </TabPanel>

        {/* ---------- 1:1 and notes ---------- */}
        <TabPanel id="talks">
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-3">
              <SectionHead title="שיחות וסיכומים">
                <button className="btn-primary !px-4" onClick={() => setReviewing(true)}>
                  <Plus size={16} /> סיכום שיחה
                </button>
              </SectionHead>
              {(reviews.data ?? []).length === 0 && <p className="card p-4 text-sm text-slate-600">עדיין לא נרשמו שיחות. לאחר כל שיחת מעקב אפשר לתעד סיכום, הסכמות ומשימות להמשך.</p>}
              <ul className="space-y-2">
                {(reviews.data ?? []).map((r: AgentReview) => {
                  const followUp = (data?.tasks ?? []).filter((t) => t.review_id === r.id)
                  const isOpen = openReview === r.id
                  return (
                    <li key={r.id} className="card p-3">
                      <button className="flex min-h-11 w-full flex-col items-stretch gap-1 text-right" aria-expanded={isOpen} onClick={() => setOpenReview(isOpen ? null : r.id)}>
                        <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                          <span className="text-sm font-semibold text-slate-800">
                            {REVIEW_KINDS[r.kind]} · {formatDate(r.review_date)}
                          </span>
                          <span className="flex items-center gap-2 text-xs text-slate-600">
                            {r.rating && <span className="chip border-slate-200 bg-slate-50 !px-2 !py-0 text-slate-700">הערכה {r.rating}/5</span>}
                            {followUp.length > 0 && `${followUp.filter((t) => t.status === 'done').length}/${followUp.length} משימות`}
                          </span>
                        </span>
                        {!isOpen && r.summary && (
                          <span dir="auto" className="line-clamp-2 text-sm font-normal text-slate-600">
                            {r.summary}
                          </span>
                        )}
                      </button>
                      {isOpen && (
                        <div className="mt-2 space-y-2 text-sm">
                          {r.summary && (
                            <p dir="auto" className="whitespace-pre-wrap text-slate-700">
                              {r.summary}
                            </p>
                          )}
                          {r.agreements && (
                            <p dir="auto" className="whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-slate-700">
                              <span className="font-medium">הסכמות: </span>
                              {r.agreements}
                            </p>
                          )}
                          {followUp.length > 0 && (
                            <ul className="space-y-0.5 text-xs">
                              {followUp.map((t) => (
                                <li key={t.id} className={t.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-700'}>
                                  • {t.description}
                                  {t.due_date ? ` (${formatDate(t.due_date)})` : ''}
                                </li>
                              ))}
                            </ul>
                          )}
                          <ConfirmButton className="btn-ghost text-sm text-red-600" message="למחוק את הסיכום? המשימות שנוצרו ממנו יישארו." onConfirm={() => delReview.mutate(r.id)}>
                            <Trash2 size={14} /> מחיקה
                          </ConfirmButton>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>

            <section className="space-y-3">
              <SectionHead title="הערות מנהל" />
              <p className="-mt-2 text-xs text-slate-600">גלויות רק למנהלים.</p>
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!noteText.trim()) return
                  addNote.mutate({ agent_id: id, body: noteText, note_date: today }, { onSuccess: () => setNoteText('') })
                }}
              >
                <Field label="הערה חדשה">
                  <textarea className="input min-h-20" dir="auto" placeholder="הערה חופשית על הסוכן…" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                </Field>
                <button className="btn-secondary" disabled={!noteText.trim() || addNote.isPending}>
                  הוסף הערה
                </button>
              </form>
              {(notes.data ?? []).length === 0 && <p className="text-sm text-slate-600">אין הערות עדיין.</p>}
              <ul className="space-y-2">
                {(notes.data ?? []).map((n) => (
                  <li key={n.id} className="card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-slate-600">{formatDate(n.note_date)}</p>
                      <ConfirmButton className="btn-ghost !px-2 text-slate-500 hover:text-red-600" message="למחוק את ההערה?" label="מחיקת ההערה" onConfirm={() => delNote.mutate(n.id)}>
                        <Trash2 size={15} />
                      </ConfirmButton>
                    </div>
                    <p dir="auto" className="whitespace-pre-wrap text-sm text-slate-700">
                      {n.body}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <div className="mt-8 space-y-3 border-t border-slate-200 pt-5" id="agent-evaluation">
            <SectionHead title="הערכה וסיכום ביצועים">
              <button className="btn-secondary !px-4 print:hidden" onClick={() => window.print()}>
                <Printer size={15} /> הדפס
              </button>
            </SectionHead>
            <p className="text-sm text-slate-600 print:hidden">סיכום ביצועים ל-{period.label}, להדפסה או לשמירה כ-PDF.</p>
            <div className="card space-y-4 p-4 sm:p-5">
              <div>
                <h3 className="text-lg font-bold text-brand-800">סיכום ביצועים — {name}</h3>
                <p className="text-sm text-slate-600">{period.label}</p>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {[
                    ['פגישות שהתקיימו', metrics?.meetings_held],
                    ['רופאים בקצב קשר תקין', metrics?.cadence_ok_pct != null ? `${metrics.cadence_ok_pct}%` : '—'],
                    ['משימות שהושלמו בתקופה', metrics?.tasks_done],
                    ['משימות פתוחות / באיחור / תקועות', `${metrics?.tasks_open ?? 0} / ${metrics?.tasks_overdue ?? 0} / ${metrics?.tasks_blocked ?? 0}`],
                    ['סריקות שנוספו', metrics?.scans_created],
                    ['ספירות מתכלים', metrics?.consumable_counts],
                    ['רופאים פוטנציאליים חדשים', metrics?.new_potential_doctors],
                    ['ניתוחים בבתי החולים שבאחריותו', metrics?.surgeries_covered],
                  ].map(([k, v]) => (
                    <tr key={String(k)} className="border-b border-slate-100">
                      <td className="py-2 pl-3 text-slate-700">{k}</td>
                      <td className="py-2 text-left font-semibold text-slate-800">{v ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div>
                <h4 className="mb-2 font-semibold text-slate-800">יעדים</h4>
                <GoalBars goals={myGoals} data={data} />
                {myGoals.length > 0 && (
                  <p className="mt-2 text-xs text-slate-600">
                    ממוצע התקדמות: {Math.round(myGoals.map((g) => goalProgress(g, data).pct).reduce((a, b) => a + b, 0) / myGoals.length)}%
                  </p>
                )}
              </div>
              {periodReviews.length > 0 && (
                <div>
                  <h4 className="mb-2 font-semibold text-slate-800">שיחות בתקופה</h4>
                  <ul className="space-y-2 text-sm">
                    {periodReviews.map((r) => (
                      <li key={r.id} dir="auto" className="text-slate-700">
                        <span className="font-medium">
                          {formatDate(r.review_date)} · {REVIEW_KINDS[r.kind]}
                          {r.rating ? ` · הערכה ${r.rating}/5` : ''}:
                        </span>{' '}
                        {r.summary}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-slate-500">{Object.entries(AUTO_METRICS).length} מדדים נמדדים אוטומטית מהמערכת; יעדי מכירות מעודכנים ידנית על ידי המנהל.</p>
            </div>
          </div>
        </TabPanel>
      </Tabs>

      {goalModal && <GoalFormModal agentId={id} goal={goalModal.goal} period={period} onClose={() => setGoalModal(null)} />}
      {reviewing && <ReviewFormModal agentId={id} agentName={name} onClose={() => setReviewing(false)} />}
      {assigning && <TaskFormModal defaults={{ assignee_id: id }} onClose={() => setAssigning(false)} />}
    </div>
  )
}
