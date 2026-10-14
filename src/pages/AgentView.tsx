import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Building2, CalendarDays, ChevronLeft, ChevronRight, Plus, Printer, Scissors, Trash2 } from 'lucide-react'
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
import { ConfirmButton, EmptyState, Spinner, Tab, TabList, TabPanel, Tabs } from '../components/ui'
import { classNames, formatDate, formatTime, todayISO } from '../lib/utils'

const dayName = (d: string) => new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' }).format(new Date(`${d}T12:00:00`))

function Kpi({ label, value, bad, hint }: { label: string; value: string | number | null; bad?: boolean; hint?: string }) {
  return (
    <div className="card p-3">
      <p className={classNames('text-2xl font-bold', bad ? 'text-red-600' : 'text-slate-800')}>{value ?? '—'}</p>
      <p className="text-xs text-slate-500">{label}</p>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
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
  const ownedProjects = (projects.data ?? []).filter((p) => p.owner_id === id && p.status === 'active')

  const taskRow = (t: TaskRow) => (
    <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <span dir="auto" className="min-w-0 flex-1 text-slate-800">
        {t.description}
        {t.project && (
          <Link to={`/projects/${t.project.id}`} className="mr-2 text-xs text-violet-600 hover:underline">
            פרויקט: {t.project.name}
          </Link>
        )}
      </span>
      <span className="flex items-center gap-2 text-xs">
        {t.status === 'blocked' && <span className="text-red-600">תקוע</span>}
        {t.waiting_for && <span className="text-amber-600">ממתין ל: {t.waiting_for}</span>}
        {t.due_date && <span className={classNames(t.due_date < today ? 'font-medium text-red-600' : 'text-slate-400')}>{formatDate(t.due_date)}</span>}
      </span>
    </li>
  )

  const periodControls = (
    <div className="flex items-center gap-2">
      <select className="input !w-auto" value={kind} onChange={(e) => { setKind(e.target.value as 'month' | 'quarter'); setOffset(0) }}>
        <option value="month">חודשי</option>
        <option value="quarter">רבעוני</option>
      </select>
      <button className="btn-ghost !px-2" onClick={() => setOffset((o) => o - 1)} aria-label="תקופה קודמת">
        <ChevronRight size={18} />
      </button>
      <span className="min-w-28 text-center text-sm font-semibold text-slate-700">{period.label}</span>
      <button className="btn-ghost !px-2" onClick={() => setOffset((o) => o + 1)} aria-label="תקופה הבאה">
        <ChevronLeft size={18} />
      </button>
    </div>
  )

  return (
    <div className="space-y-4">
      <Link to="/agents" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowRight size={15} />
        כל הסוכנים
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{agent.full_name || agent.email}</h1>
          <p dir="ltr" className="text-right text-sm text-slate-400">
            {agent.email}
          </p>
        </div>
        {periodControls}
      </div>

      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab id="overview">סקירה</Tab>
          <Tab id="schedule">לוז</Tab>
          <Tab id="tasks">משימות ופרויקטים</Tab>
          <Tab id="goals">יעדים ({myGoals.length})</Tab>
          <Tab id="training">הכשרות</Tab>
          <Tab id="reviews">שיחות והערות</Tab>
          <Tab id="evaluation">הערכה</Tab>
        </TabList>

        {/* ---------- overview ---------- */}
        <TabPanel id="overview">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="פגישות שהתקיימו" value={metrics?.meetings_held ?? null} />
              <Kpi label="רופאים באיחור קשר" value={metrics?.cadence_due ?? null} bad={(metrics?.cadence_due ?? 0) > 0} hint={metrics?.cadence_ok_pct != null ? `${metrics.cadence_ok_pct}% בקצב תקין` : 'לא הוגדר קצב קשר'} />
              <Kpi label="משימות פתוחות" value={metrics?.tasks_open ?? null} hint={`${metrics?.tasks_done ?? 0} הושלמו בתקופה`} />
              <Kpi label="משימות באיחור" value={metrics?.tasks_overdue ?? null} bad={(metrics?.tasks_overdue ?? 0) > 0} />
              <Kpi label="משימות תקועות" value={metrics?.tasks_blocked ?? null} bad={(metrics?.tasks_blocked ?? 0) > 0} />
              <Kpi label="סריקות שנוספו" value={metrics?.scans_created ?? null} />
              <Kpi label="ספירות מתכלים" value={metrics?.consumable_counts ?? null} />
              <Kpi label="ניתוחים בבתי החולים שלו" value={metrics?.surgeries_covered ?? null} />
            </div>
            <div className="card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-slate-800">יעדים — {period.label}</h2>
                <button className="btn-secondary" onClick={() => setGoalModal({})}>
                  <Plus size={15} /> יעד
                </button>
              </div>
              <GoalBars goals={myGoals} data={data} onEdit={(g) => setGoalModal({ goal: g })} empty="אין יעדים לתקופה. הוסף יעד כדי לעקוב אחרי ההתקדמות." />
            </div>
          </div>
        </TabPanel>

        {/* ---------- weekly schedule ---------- */}
        <TabPanel id="schedule">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button className="btn-ghost !px-2" onClick={() => setWeek((w) => w - 1)} aria-label="שבוע קודם">
                  <ChevronRight size={18} />
                </button>
                <span className="text-sm font-semibold text-slate-700">
                  {formatDate(wk.start)} – {formatDate(wk.end)}
                </span>
                <button className="btn-ghost !px-2" onClick={() => setWeek((w) => w + 1)} aria-label="שבוע הבא">
                  <ChevronLeft size={18} />
                </button>
                {week !== 0 && (
                  <button className="text-xs text-brand-600 hover:underline" onClick={() => setWeek(0)}>
                    השבוע
                  </button>
                )}
              </div>
              <span className="text-xs text-slate-400">
                {weekMeetings.length} פגישות · {weekSurgeries.length} ניתוחים בבתי החולים שלו
              </span>
            </div>
            <div className="space-y-2">
              {wk.days.map((d) => {
                const ms = weekMeetings.filter((m) => m.meeting_date === d).sort((a, b) => (a.meeting_time ?? '').localeCompare(b.meeting_time ?? ''))
                const ss = weekSurgeries.filter((s) => s.surgery_date === d)
                return (
                  <section key={d} className={classNames('card p-3', d === today && 'border-brand-300')}>
                    <h3 className="mb-1 flex items-center justify-between text-sm font-semibold text-slate-700">
                      {dayName(d)}
                      {ms.length + ss.length === 0 && <span className="text-xs font-normal text-slate-300">פנוי</span>}
                    </h3>
                    {ms.length > 0 && (
                      <ul className="space-y-1">
                        {ms.map((m) => (
                          <li key={m.id}>
                            <Link to={`/meetings/${m.id}`} className="flex flex-wrap items-center gap-x-3 text-sm hover:bg-slate-50">
                              <CalendarDays size={13} className="text-brand-500" />
                              <span className="text-xs text-slate-400">{m.meeting_time ? formatTime(m.meeting_time) : ''}</span>
                              <span className="font-medium text-slate-800">{m.subject || 'פגישה'}</span>
                              <span className="text-xs text-slate-500">{[m.meeting_doctors.flatMap((x) => (x.doctor ? [x.doctor.name] : [])).join(', '), m.hospital?.name].filter(Boolean).join(' · ')}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                    {ss.length > 0 && (
                      <ul className="mt-1 space-y-1">
                        {ss.map((s) => (
                          <li key={s.id} className="flex flex-wrap items-center gap-x-3 text-sm">
                            <Scissors size={13} className="text-red-500" />
                            <span className="font-medium text-slate-800">
                              {SCAN_PROCEDURE_LABELS[s.procedure_type] ?? s.procedure_type} {s.side}
                            </span>
                            <span className="text-xs text-slate-500">{[s.hospital?.name, s.surgeon ? `${s.surgeon.title} ${s.surgeon.name}` : ''].filter(Boolean).join(' · ')}</span>
                            {!s.plan_ready && <span className="text-xs text-amber-600">תוכנית לא מוכנה</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )
              })}
            </div>
            {hospitalIds.size === 0 && (
              <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <Building2 size={14} /> לא שויכו לסוכן בתי חולים (בהגדרות ← בתי חולים), ולכן ניתוחים לא מוצגים בלוז שלו.
              </p>
            )}
          </div>
        </TabPanel>

        {/* ---------- tasks and projects ---------- */}
        <TabPanel id="tasks">
          <div className="space-y-4">
            <div className="flex justify-end">
              <button className="btn-primary" onClick={() => setAssigning(true)}>
                <Plus size={16} /> הקצה משימה לסוכן
              </button>
            </div>
            {[
              { title: `באיחור (${overdue.length})`, list: overdue, tone: 'text-red-600' },
              { title: `תקועות (${blocked.length})`, list: blocked, tone: 'text-red-600' },
              { title: `כל המשימות הפתוחות (${open.length})`, list: open, tone: 'text-slate-800' },
            ].map((g) => (
              <section key={g.title} className="card p-4">
                <h2 className={classNames('mb-1 font-semibold', g.tone)}>{g.title}</h2>
                {g.list.length === 0 ? <p className="text-sm text-slate-400">אין.</p> : <ul className="divide-y divide-slate-100">{g.list.map(taskRow)}</ul>}
              </section>
            ))}
            <section className="card p-4">
              <h2 className="mb-1 font-semibold text-slate-800">פרויקטים באחריותו ({ownedProjects.length})</h2>
              {ownedProjects.length === 0 ? (
                <p className="text-sm text-slate-400">אין פרויקטים פעילים.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {ownedProjects.map((p) => {
                    const st = projectStats((data?.tasks ?? []).filter((t) => t.project_id === p.id))
                    return (
                      <li key={p.id}>
                        <Link to={`/projects/${p.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm hover:bg-slate-50">
                          <span dir="auto" className="font-medium text-slate-800">
                            {p.name}
                          </span>
                          <span className="flex items-center gap-3 text-xs">
                            {st.blocked.length > 0 && <span className="text-red-600">{st.blocked.length} תקועות</span>}
                            {st.overdue.length > 0 && <span className="text-amber-600">{st.overdue.length} באיחור</span>}
                            <span className="text-slate-500">{st.percent}%</span>
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>
        </TabPanel>

        {/* ---------- goals ---------- */}
        <TabPanel id="goals">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">יעדים שחופפים ל-{period.label}. הסוכן רואה את היעדים וההתקדמות שלו בדף הבית.</p>
              <button className="btn-primary" onClick={() => setGoalModal({})}>
                <Plus size={16} /> יעד חדש
              </button>
            </div>
            <div className="card p-4">
              <GoalBars goals={myGoals} data={data} onEdit={(g) => setGoalModal({ goal: g })} />
            </div>
            {(goals.data ?? []).filter((g) => g.agent_id === id && !overlaps(g, period)).length > 0 && (
              <details className="card p-4">
                <summary className="cursor-pointer text-sm font-medium text-slate-600">יעדים מתקופות אחרות</summary>
                <div className="mt-3">
                  <GoalBars goals={(goals.data ?? []).filter((g) => g.agent_id === id && !overlaps(g, period))} data={data} onEdit={(g) => setGoalModal({ goal: g })} />
                </div>
              </details>
            )}
          </div>
        </TabPanel>

        {/* ---------- training ---------- */}
        <TabPanel id="training">
          <TrainingPanel agentId={id} />
          <LearnSummary agentId={id} />
        </TabPanel>

        {/* ---------- 1:1 and notes ---------- */}
        <TabPanel id="reviews">
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-800">שיחות וסיכומים</h2>
                <button className="btn-primary" onClick={() => setReviewing(true)}>
                  <Plus size={16} /> סיכום שיחה
                </button>
              </div>
              {(reviews.data ?? []).length === 0 && <p className="text-sm text-slate-400">עדיין לא נרשמו שיחות.</p>}
              <ul className="space-y-2">
                {(reviews.data ?? []).map((r: AgentReview) => {
                  const followUp = (data?.tasks ?? []).filter((t) => t.review_id === r.id)
                  const isOpen = openReview === r.id
                  return (
                    <li key={r.id} className="card p-3">
                      <button className="flex w-full items-center justify-between gap-2 text-right" onClick={() => setOpenReview(isOpen ? null : r.id)}>
                        <span className="text-sm font-medium text-slate-800">
                          {REVIEW_KINDS[r.kind]} · {formatDate(r.review_date)}
                        </span>
                        <span className="flex items-center gap-2 text-xs text-slate-400">
                          {r.rating && <span className="chip border-slate-200 bg-slate-50 !px-2 !py-0 text-slate-600">הערכה {r.rating}/5</span>}
                          {followUp.length > 0 && `${followUp.filter((t) => t.status === 'done').length}/${followUp.length} משימות`}
                        </span>
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
                                <li key={t.id} className={t.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-600'}>
                                  • {t.description}
                                  {t.due_date ? ` (${formatDate(t.due_date)})` : ''}
                                </li>
                              ))}
                            </ul>
                          )}
                          <ConfirmButton className="btn-ghost text-xs text-red-500" message="למחוק את הסיכום? המשימות שנוצרו ממנו יישארו." onConfirm={() => delReview.mutate(r.id)}>
                            <Trash2 size={13} /> מחיקה
                          </ConfirmButton>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="font-semibold text-slate-800">הערות מנהל (גלויות רק למנהלים)</h2>
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!noteText.trim()) return
                  addNote.mutate({ agent_id: id, body: noteText, note_date: today }, { onSuccess: () => setNoteText('') })
                }}
              >
                <textarea className="input min-h-16" dir="auto" placeholder="הערה חופשית על הסוכן…" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                <button className="btn-secondary" disabled={!noteText.trim() || addNote.isPending}>
                  הוסף הערה
                </button>
              </form>
              <ul className="space-y-2">
                {(notes.data ?? []).map((n) => (
                  <li key={n.id} className="card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-slate-400">{formatDate(n.note_date)}</p>
                      <ConfirmButton className="btn-ghost !px-1.5 text-slate-300 hover:text-red-500" message="למחוק את ההערה?" onConfirm={() => delNote.mutate(n.id)}>
                        <Trash2 size={13} />
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
        </TabPanel>

        {/* ---------- evaluation summary ---------- */}
        <TabPanel id="evaluation">
          <div className="space-y-4" id="agent-evaluation">
            <div className="flex items-center justify-between print:hidden">
              <p className="text-sm text-slate-500">סיכום ביצועים ל-{period.label}, להדפסה או לשמירה כ-PDF.</p>
              <button className="btn-secondary" onClick={() => window.print()}>
                <Printer size={15} /> הדפס
              </button>
            </div>
            <div className="card space-y-4 p-5">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  סיכום ביצועים — {agent.full_name || agent.email}
                </h2>
                <p className="text-sm text-slate-400">{period.label}</p>
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
                      <td className="py-1.5 text-slate-600">{k}</td>
                      <td className="py-1.5 text-left font-medium text-slate-800">{v ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div>
                <h3 className="mb-2 font-semibold text-slate-700">יעדים</h3>
                <GoalBars goals={myGoals} data={data} />
                {myGoals.length > 0 && (
                  <p className="mt-2 text-xs text-slate-400">
                    ממוצע התקדמות:{' '}
                    {Math.round(myGoals.map((g) => goalProgress(g, data).pct).reduce((a, b) => a + b, 0) / myGoals.length)}%
                  </p>
                )}
              </div>
              {(reviews.data ?? []).filter((r) => r.review_date >= period.start && r.review_date <= period.end).length > 0 && (
                <div>
                  <h3 className="mb-2 font-semibold text-slate-700">שיחות בתקופה</h3>
                  <ul className="space-y-2 text-sm">
                    {(reviews.data ?? [])
                      .filter((r) => r.review_date >= period.start && r.review_date <= period.end)
                      .map((r) => (
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
              <p className="text-[11px] text-slate-300">
                {Object.entries(AUTO_METRICS).length} מדדים נמדדים אוטומטית מהמערכת; יעדי מכירות מעודכנים ידנית על ידי המנהל.
              </p>
            </div>
          </div>
        </TabPanel>
      </Tabs>

      {goalModal && <GoalFormModal agentId={id} goal={goalModal.goal} period={period} onClose={() => setGoalModal(null)} />}
      {reviewing && <ReviewFormModal agentId={id} agentName={agent.full_name || agent.email} onClose={() => setReviewing(false)} />}
      {assigning && <TaskFormModal defaults={{ assignee_id: id }} onClose={() => setAssigning(false)} />}
    </div>
  )
}

