// The numbers of the team page, the management report and the presentation — computed once, from the records of the system.
import { addMonths, format, startOfMonth } from 'date-fns'
import { computeAgentMetrics, goalProgress, HELD_MEETING, overlaps, type AgentMetrics, type MetricData, type Period } from './agentMetrics'
import { scopeState, stagesOf } from './training'
import { PIPELINE_STAGES } from './types'
import type { AgentGoal, AgentTraining, Procedure, Profile, TrainingStage } from './types'
import { todayISO } from './utils'
import { funnelStats, lostSummary, stageSinceMap, stuckPotentials, type HistoryRow, type StageStat, type StuckThresholds } from './pipelineStats'

export type Level = 'red' | 'amber'
export type Attention = { level: Level; text: string }

export type Delta = { value: number; prev: number | null; /** percent change, null when there is nothing to compare with */ pct: number | null }

export type AgentRow = {
  agent: Profile
  m: AgentMetrics
  prev: AgentMetrics
  goalsCount: number
  goalsAvg: number | null
  training: { done: number; total: number; pct: number | null; stuck: number }
  /** days since the last meeting that took place (null: none on record) */
  lastMeetingDays: number | null
  /** held meetings per month, oldest first (same months as the team series) */
  meetingsSeries: number[]
  attention: Attention[]
}

export type MonthPoint = { key: string; label: string; meetings: number; surgeries: number; tasks: number; newDoctors: number }

export type TeamModel = {
  period: Period
  prevPeriod: Period
  agents: AgentRow[]
  kpis: { surgeries: Delta; meetings: Delta; goals: Delta; hasGoals: boolean; newDoctors: Delta; training: { pct: number | null; stuck: number } }
  series: MonthPoint[]
  funnel: { stage: string; count: number }[]
  potentialTotal: number
  /** the funnel in numbers: how many reach each stage, the share that moves on, the time in a stage, the doctors that need a push, the ones closed as not relevant */
  pipeline: { stats: StageStat[]; stuck: number; lost: { count: number; reasons: [string, number][] } }
  /** potential doctors in the last two stages (negotiation, closing) */
  closing: number
  attention: { agent: Profile; level: Level; text: string }[]
  summary: string[]
}

/** Hebrew counts: one is said differently from many */
export const stuckText = (n: number) => (n === 1 ? 'הכשרה תקועה אחת' : `${n} הכשרות תקועות`)

const mk = (d: string | null | undefined) => (d ? d.slice(0, 7) : '')
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86_400_000)

export function change(value: number, prev: number | null): Delta {
  return { value, prev, pct: prev != null && prev > 0 ? Math.round(((value - prev) / prev) * 100) : null }
}

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null)

export function buildTeamModel(input: {
  period: Period
  prevPeriod: Period
  agents: Profile[]
  data: MetricData
  goals: AgentGoal[]
  stages: TrainingStage[]
  training: AgentTraining[]
  procedures: Procedure[]
  /** the stages of the funnel, in order (the managers edit them) */
  pipelineStages?: string[]
  /** every recorded change of stage of the potential doctors */
  stageHistory?: HistoryRow[]
  /** after how many days in a stage a potential doctor counts as stuck */
  stuckThresholds?: StuckThresholds
  months?: number
}): TeamModel {
  const { period, prevPeriod, data, goals, stages, training, procedures } = input
  const today = todayISO()
  const people = input.agents.filter((a) => a.role === 'agent')
  const monthsCount = input.months ?? 6

  // the months of the trend: the last N ending with the month of the shown period
  const lastMonth = startOfMonth(new Date(`${period.end}T12:00:00`))
  const months = Array.from({ length: monthsCount }, (_, i) => {
    const d = addMonths(lastMonth, i - (monthsCount - 1))
    return { key: format(d, 'yyyy-MM'), label: new Intl.DateTimeFormat('he-IL', { month: 'short' }).format(d) }
  })

  const heldAll = data.meetings.filter((m) => HELD_MEETING.has(m.status) && !!m.meeting_date && m.meeting_date <= today)
  const surgeriesAll = data.scans.filter((s) => s.status !== 'cancelled' && !!s.surgery_date && (s.surgery_date as string) <= today)
  const inP = (d: string | null | undefined, p: Period) => !!d && d >= p.start && d <= p.end

  const series: MonthPoint[] = months.map((m) => ({
    ...m,
    meetings: heldAll.filter((x) => mk(x.meeting_date) === m.key).length,
    surgeries: surgeriesAll.filter((s) => mk(s.surgery_date) === m.key).length,
    tasks: data.tasks.filter((t) => t.status === 'done' && mk(t.done_at) === m.key).length,
    newDoctors: data.doctors.filter((d) => mk(d.created_at) === m.key).length,
  }))

  // training: every scope (general + procedures) that has stages
  const scopes = [null as string | null, ...procedures.map((p) => p.id)].map((id) => ({ id, stages: stagesOf(stages, id), title: id ? (procedures.find((p) => p.id === id)?.name ?? '') : 'כללי' })).filter((s) => s.stages.length > 0)

  const rows: AgentRow[] = people.map((agent) => {
    const m = computeAgentMetrics(agent.id, period, data)
    const prev = computeAgentMetrics(agent.id, prevPeriod, data)
    const mine = goals.filter((g) => g.agent_id === agent.id && overlaps(g, period))
    const pcts = mine.map((g) => goalProgress(g, data).pct)
    const rowsOf = training.filter((r) => r.agent_id === agent.id)
    let done = 0
    let total = 0
    const stuckScopes: string[] = []
    for (const sc of scopes) {
      const st = scopeState(sc.stages, rowsOf, today)
      done += st.doneCount
      total += st.total
      if (st.stuck) stuckScopes.push(sc.title)
    }
    const myHeld = heldAll.filter((x) => x.responsible_agent_id === agent.id || x.meeting_agents.some((a) => a.agent?.id === agent.id))
    const last = myHeld.reduce<string | null>((best, x) => (!best || (x.meeting_date as string) > best ? (x.meeting_date as string) : best), null)
    const lastMeetingDays = last ? daysBetween(last, today) : null

    const attention: Attention[] = []
    if (m.tasks_overdue > 0) attention.push({ level: m.tasks_overdue >= 3 ? 'red' : 'amber', text: m.tasks_overdue === 1 ? 'משימה אחת באיחור' : `${m.tasks_overdue} משימות באיחור` })
    if (m.tasks_blocked > 0) attention.push({ level: 'amber', text: m.tasks_blocked === 1 ? 'משימה אחת תקועה' : `${m.tasks_blocked} משימות תקועות` })
    if (m.cadence_due > 0) attention.push({ level: m.cadence_due >= 5 ? 'red' : 'amber', text: m.cadence_due === 1 ? 'רופא אחד באיחור קשר' : `${m.cadence_due} רופאים באיחור קשר` })
    if (lastMeetingDays === null) attention.push({ level: 'amber', text: 'אין פגישות מתועדות' })
    else if (lastMeetingDays >= 21) attention.push({ level: lastMeetingDays >= 30 ? 'red' : 'amber', text: `ללא פגישה ${lastMeetingDays} ימים` })
    for (const s of stuckScopes) attention.push({ level: 'red', text: `הכשרה תקועה: ${s}` })
    for (const g of mine) {
      if (g.metric === 'text') continue
      const span = Math.max(1, daysBetween(g.period_start, g.period_end))
      const pace = Math.min(100, Math.max(0, Math.round((daysBetween(g.period_start, today < g.period_end ? today : g.period_end) / span) * 100)))
      const pct = goalProgress(g, data).pct
      if (pace >= 30 && pct < pace - 25) attention.push({ level: 'amber', text: `יעד "${g.title}" מתקדם לאט (${pct}% מול ${pace}% מהזמן)` })
    }
    attention.sort((a, b) => Number(b.level === 'red') - Number(a.level === 'red'))

    return {
      agent,
      m,
      prev,
      goalsCount: mine.length,
      goalsAvg: avg(pcts),
      training: { done, total, pct: total > 0 ? Math.round((done / total) * 100) : null, stuck: stuckScopes.length },
      lastMeetingDays,
      meetingsSeries: months.map((mo) => myHeld.filter((x) => mk(x.meeting_date) === mo.key).length),
      attention,
    }
  })

  // team totals — each meeting and surgery counted once, whoever is on it
  const surgeriesNow = surgeriesAll.filter((s) => inP(s.surgery_date, period)).length
  const surgeriesPrev = surgeriesAll.filter((s) => inP(s.surgery_date, prevPeriod)).length
  const meetingsNow = heldAll.filter((x) => inP(x.meeting_date, period)).length
  const meetingsPrev = heldAll.filter((x) => inP(x.meeting_date, prevPeriod)).length
  const newDocsNow = data.doctors.filter((d) => inP(d.created_at.slice(0, 10), period)).length
  const newDocsPrev = data.doctors.filter((d) => inP(d.created_at.slice(0, 10), prevPeriod)).length
  const goalsNow = avg(rows.flatMap((r) => (r.goalsAvg != null ? [r.goalsAvg] : [])))
  const goalsPrevPcts = people.flatMap((a) => goals.filter((g) => g.agent_id === a.id && overlaps(g, prevPeriod)).map((g) => goalProgress(g, data).pct))
  const goalsPrev = avg(goalsPrevPcts)
  const trainTotal = rows.reduce((s, r) => s + r.training.total, 0)
  const trainDone = rows.reduce((s, r) => s + r.training.done, 0)
  const trainingPct = trainTotal > 0 ? Math.round((trainDone / trainTotal) * 100) : null

  const potential = data.doctors.filter((d) => d.status === 'potential')
  const funnel = (input.pipelineStages ?? [...PIPELINE_STAGES]).map((stage) => ({ stage: stage as string, count: potential.filter((d) => d.pipeline_stage === stage).length }))
  const closing = funnel.slice(-2).reduce((s, f) => s + f.count, 0)
  const stageNames = funnel.map((f) => f.stage)
  const history = input.stageHistory ?? []
  const pipeline = {
    stats: funnelStats(stageNames, history),
    stuck: stuckPotentials(data.doctors, stageSinceMap(history), input.stuckThresholds).length,
    lost: lostSummary(data.doctors),
  }

  const attention = rows
    .flatMap((r) => r.attention.map((a) => ({ agent: r.agent, ...a })))
    .sort((a, b) => Number(b.level === 'red') - Number(a.level === 'red'))

  const kpis = {
    surgeries: change(surgeriesNow, surgeriesPrev),
    meetings: change(meetingsNow, meetingsPrev),
    goals: { value: goalsNow ?? 0, prev: goalsPrev, pct: goalsNow != null && goalsPrev != null ? goalsNow - goalsPrev : null },
    hasGoals: goalsNow != null,
    newDoctors: change(newDocsNow, newDocsPrev),
    training: { pct: trainingPct, stuck: rows.reduce((s, r) => s + r.training.stuck, 0) },
  }

  // the sentences of the report: what improved, what fell, what needs a hand
  const how = (label: string, d: Delta, unit: string) => {
    if (d.pct === null) return `${label}: ${d.value} ${unit} ב${period.label}.`
    if (d.pct === 0) return `${label}: ${d.value} ${unit}, ללא שינוי לעומת ${prevPeriod.label}.`
    return `${label}: ${d.value} ${unit}, ${d.pct > 0 ? 'עלייה' : 'ירידה'} של ${Math.abs(d.pct)}% לעומת ${prevPeriod.label} (${d.prev}).`
  }
  const summary: string[] = [how('ניתוחי MAKO', kpis.surgeries, 'ניתוחים'), how('פגישות שהתקיימו', kpis.meetings, 'פגישות')]
  if (goalsNow != null) {
    const met = rows.filter((r) => (r.goalsAvg ?? 0) >= 80).length
    summary.push(`עמידה ממוצעת ביעדים: ${goalsNow}%${met > 0 ? `; ${met} מתוך ${rows.filter((r) => r.goalsCount > 0).length} סוכנים מעל 80%` : ''}.`)
  }
  summary.push(`בפיפליין ${potential.length} רופאים פוטנציאליים, ${closing} מהם בשלבי משא ומתן וסגירה${pipeline.stuck > 0 ? `; ${pipeline.stuck} מהם דורשים דחיפה (תקועים, בלי צעד הבא או באיחור)` : ''}.`)
  if (pipeline.lost.count > 0) summary.push(`${pipeline.lost.count} רופאים נסגרו כלא רלוונטיים${pipeline.lost.reasons[0] ? `, הסיבה השכיחה: ${pipeline.lost.reasons[0][0]}` : ''}.`)
  if (trainingPct != null) summary.push(`${trainingPct}% משלבי ההכשרה הושלמו${kpis.training.stuck > 0 ? `; ${stuckText(kpis.training.stuck)}` : ''}.`)
  const needing = [...new Set(attention.filter((a) => a.level === 'red').map((a) => a.agent.full_name || a.agent.email))]
  summary.push(needing.length > 0 ? `דורשים תשומת לב מיידית: ${needing.join(', ')}.` : 'אין חריגים דחופים בצוות.')

  return { period, prevPeriod, agents: rows, kpis, series, funnel, potentialTotal: potential.length, pipeline, closing, attention, summary }
}
