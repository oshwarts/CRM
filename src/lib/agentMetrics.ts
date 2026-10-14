import { addDays, addMonths, endOfMonth, format, startOfMonth, startOfQuarter, endOfQuarter, addQuarters, startOfWeek, endOfWeek, parseISO } from 'date-fns'
import { contactState } from './cadence'
import type { AgentGoal, DoctorListItem, MeetingWithRelations, PatientScanRow, TaskRow } from './types'
import { todayISO } from './utils'

/* ---------------- periods ---------------- */
export type Period = { start: string; end: string; label: string; kind: 'month' | 'quarter' }
const iso = (d: Date) => format(d, 'yyyy-MM-dd')

export function monthPeriod(offset = 0): Period {
  const d = addMonths(new Date(), offset)
  return {
    start: iso(startOfMonth(d)),
    end: iso(endOfMonth(d)),
    kind: 'month',
    label: new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(d),
  }
}
export function quarterPeriod(offset = 0): Period {
  const d = addQuarters(new Date(), offset)
  return { start: iso(startOfQuarter(d)), end: iso(endOfQuarter(d)), kind: 'quarter', label: `רבעון ${Math.floor(d.getMonth() / 3) + 1} · ${d.getFullYear()}` }
}
export function weekRange(offset = 0): { start: string; end: string; days: string[] } {
  const base = addDays(new Date(), offset * 7)
  const s = startOfWeek(base, { weekStartsOn: 0 })
  const e = endOfWeek(base, { weekStartsOn: 0 })
  return { start: iso(s), end: iso(e), days: Array.from({ length: 7 }, (_, i) => iso(addDays(s, i))) }
}

/* ---------------- metrics measured from the system ---------------- */
export const AUTO_METRICS: Record<string, { label: string; unit: string }> = {
  meetings_held: { label: 'פגישות שהתקיימו', unit: '' },
  cadence_ok_pct: { label: 'רופאים בקצב קשר תקין', unit: '%' },
  tasks_done: { label: 'משימות שהושלמו', unit: '' },
  scans_created: { label: 'סריקות שנוספו למערכת', unit: '' },
  consumable_counts: { label: 'ספירות מתכלים', unit: '' },
  new_potential_doctors: { label: 'רופאים פוטנציאליים חדשים', unit: '' },
  surgeries_covered: { label: 'ניתוחים בבתי החולים שבאחריותו', unit: '' },
}

export const CATEGORY_LABELS: Record<string, string> = {
  activity: 'פעילות',
  sales: 'מכירות',
  development: 'התפתחות',
  personal: 'אישי',
}

export type MetricData = {
  meetings: MeetingWithRelations[]
  scans: PatientScanRow[]
  doctors: DoctorListItem[]
  tasks: TaskRow[]
  favorites: { user_id: string; doctor_id: string }[]
  counts: { counted_by: string | null; counted_on: string }[]
  /** agent id → hospitals he is responsible for */
  hospitalsOf: Map<string, string[]>
}

export type AgentMetrics = {
  meetings_held: number
  cadence_ok_pct: number | null
  cadence_due: number
  tasks_done: number
  tasks_open: number
  tasks_overdue: number
  tasks_blocked: number
  scans_created: number
  consumable_counts: number
  new_potential_doctors: number
  surgeries_covered: number
}

const inPeriod = (d: string | null | undefined, p: Period) => !!d && d >= p.start && d <= p.end

export function agentMeetings(agentId: string, meetings: MeetingWithRelations[]) {
  return meetings.filter((m) => m.responsible_agent_id === agentId || m.meeting_agents.some((a) => a.agent?.id === agentId))
}

export function computeAgentMetrics(agentId: string, p: Period, data: MetricData): AgentMetrics {
  const today = todayISO()
  const held = agentMeetings(agentId, data.meetings).filter((m) => m.status !== 'cancelled' && inPeriod(m.meeting_date, p) && (m.meeting_date as string) <= today)

  const favIds = new Set(data.favorites.filter((f) => f.user_id === agentId).map((f) => f.doctor_id))
  const tracked = data.doctors.filter((d) => favIds.has(d.id) && d.contact_cadence_days)
  const states = tracked.map((d) => contactState(d, data.meetings))
  const due = states.filter((s) => s.status === 'due').length

  const mine = data.tasks.filter((t) => t.assignee_id === agentId)
  const open = mine.filter((t) => t.status !== 'done')
  const hospitals = new Set(data.hospitalsOf.get(agentId) ?? [])

  return {
    meetings_held: held.length,
    cadence_ok_pct: tracked.length ? Math.round(((tracked.length - due) / tracked.length) * 100) : null,
    cadence_due: due,
    tasks_done: mine.filter((t) => t.status === 'done' && inPeriod(t.done_at?.slice(0, 10), p)).length,
    tasks_open: open.length,
    tasks_overdue: open.filter((t) => t.due_date && t.due_date < today).length,
    tasks_blocked: open.filter((t) => t.status === 'blocked').length,
    scans_created: data.scans.filter((s) => s.created_by === agentId && inPeriod(s.created_at.slice(0, 10), p)).length,
    consumable_counts: data.counts.filter((c) => c.counted_by === agentId && inPeriod(c.counted_on, p)).length,
    new_potential_doctors: data.doctors.filter((d) => d.created_by === agentId && d.status === 'potential' && inPeriod(d.created_at.slice(0, 10), p)).length,
    surgeries_covered: data.scans.filter((s) => s.status !== 'cancelled' && inPeriod(s.surgery_date, p) && hospitals.has(s.hospital_id)).length,
  }
}

/** value and percentage of a goal: from the system, typed in by the manager, or a free goal with a progress % */
export function goalProgress(g: AgentGoal, data: MetricData | null): { value: number | null; pct: number } {
  if (g.metric === 'text') return { value: null, pct: g.progress_pct }
  let value: number | null = g.current_value
  if (g.metric !== 'manual') {
    if (!data) return { value: null, pct: 0 }
    const m = computeAgentMetrics(g.agent_id, { start: g.period_start, end: g.period_end, label: '', kind: 'month' }, data)
    value = (m as unknown as Record<string, number | null>)[g.metric] ?? null
  }
  const target = g.target ?? 0
  const pct = value !== null && target > 0 ? Math.max(0, Math.min(100, Math.round((value / target) * 100))) : 0
  return { value, pct }
}

export const overlaps = (g: Pick<AgentGoal, 'period_start' | 'period_end'>, p: Period) => g.period_start <= p.end && g.period_end >= p.start
export const parse = parseISO
