// The weekly roster: each agent reports when they can work (a whole day, or morning/evening separately, with a reason when
// they can't), and a manager decides who works where. The suggestions below read the same signals a manager would — this
// agent's open tasks and meetings, and how soon the hospitals they cover have scans or surgeries — and are offers, not rules:
// the manager always has the last word, and an empty list just means nothing in particular points anywhere this week.
import { addDays, format, parseISO, startOfWeek } from 'date-fns'

export type RosterShift = 'morning' | 'evening'
export const SHIFTS: RosterShift[] = ['morning', 'evening']
export const SHIFT_LABELS: Record<RosterShift, string> = { morning: 'משמרת בוקר (מ־07:00)', evening: 'משמרת אחה״צ (מ־15:00)' }

export type AvailabilityStatus = 'available' | 'unavailable'
export type AvailabilityRow = { agent_id: string; date: string; shift: RosterShift; status: AvailabilityStatus; reason: string; note: string }

export type WorkType = 'field' | 'office' | 'training' | 'other'
export const WORK_TYPES: WorkType[] = ['field', 'office', 'training', 'other']
export const WORK_TYPE_LABELS: Record<WorkType, string> = { field: 'שטח', office: 'משרד', training: 'הדרכה', other: 'אחר' }

export type AssignmentRow = {
  agent_id: string
  date: string
  shift: RosterShift
  hospital_id: string | null
  area: string
  work_type: WorkType
  task_id: string | null
  meeting_id: string | null
  note: string
}

/** Sunday-first, the seven days of the week that holds `anchorISO` */
export function weekDates(anchorISO: string): string[] {
  const start = startOfWeek(parseISO(anchorISO), { weekStartsOn: 0 })
  return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd'))
}

export type DayAvailability = 'full' | 'morning' | 'evening' | 'none' | 'unset'

/** one day's reported availability from its (up to two) shift rows — 'unset' when the agent has not reported it yet */
export function dayAvailability(rows: Pick<AvailabilityRow, 'shift' | 'status'>[]): DayAvailability {
  if (rows.length === 0) return 'unset'
  const on = new Set(rows.filter((r) => r.status === 'available').map((r) => r.shift))
  if (on.has('morning') && on.has('evening')) return 'full'
  if (on.has('morning')) return 'morning'
  if (on.has('evening')) return 'evening'
  return 'none'
}

/** a short Hebrew line for a day's availability, with the reason when the whole day is blocked */
export function availabilityLine(rows: Pick<AvailabilityRow, 'shift' | 'status' | 'reason'>[]): string {
  const a = dayAvailability(rows)
  if (a === 'unset') return 'לא דווח'
  if (a === 'full') return 'זמין כל היום'
  if (a === 'none') {
    const reasons = [...new Set(rows.map((r) => r.reason.trim()).filter(Boolean))]
    return reasons.length ? `לא זמין — ${reasons.join(', ')}` : 'לא זמין'
  }
  return `זמין ${SHIFT_LABELS[a].split(' (')[0]} בלבד`
}

/** the status of one shift on its own (the day view already names the shift in its own heading, so this does not repeat it) */
export function shiftLine(row: Pick<AvailabilityRow, 'status' | 'reason'> | undefined): string {
  if (!row) return 'לא דווח'
  if (row.status === 'available') return 'זמין'
  return row.reason.trim() ? `לא זמין — ${row.reason.trim()}` : 'לא זמין'
}

/** how many field-work shifts each agent already has in the week — so a manager can see who is loaded and who is free */
export function teamLoad(assignments: Pick<AssignmentRow, 'agent_id' | 'work_type'>[], agentIds: string[]): Map<string, number> {
  const m = new Map(agentIds.map((id) => [id, 0]))
  for (const a of assignments) if (a.work_type === 'field') m.set(a.agent_id, (m.get(a.agent_id) ?? 0) + 1)
  return m
}

/** agents whose field-shift count this week is at least 2 above the team's average (nothing is flagged when everyone is close) */
export function overloaded(loads: Map<string, number>): Set<string> {
  const values = [...loads.values()]
  if (values.length < 2) return new Set()
  const avg = values.reduce((n, v) => n + v, 0) / values.length
  return new Set([...loads].filter(([, v]) => v >= avg + 2).map(([id]) => id))
}

export type RecTask = { assignee_id: string | null; due_date: string | null; is_done: boolean; hospital_id: string | null; hospital_name: string | null; priority: string; description: string }
export type RecMeeting = { meeting_date: string | null; status: string; agent_ids: string[]; hospital_id: string | null; hospital_name: string | null; subject: string }
export type RecScan = { hospital_id: string | null; hospital_name: string | null; ct_date: string | null; surgery_date: string | null; status: string }

export type Suggestion = { hospitalId: string | null; hospitalName: string; workType: WorkType; score: number; reasons: string[] }

const NEAR_DAYS = 3 // a CT/surgery this close counts as "coming up" for the roster

/** days between two yyyy-mm-dd strings (b − a), without a timezone trap */
function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000)
}

/**
 * Where an agent is likely needed on `date`: their own open tasks and meetings due that day, and how soon the hospitals
 * they cover have a MAKO scan or surgery. Sorted best first; an empty list means nothing in particular points anywhere.
 */
export function suggestionsFor(params: {
  agentId: string
  date: string
  tasks: RecTask[]
  meetings: RecMeeting[]
  scans: RecScan[]
  hospitalsOfAgent: { id: string; name: string }[]
}): Suggestion[] {
  const { agentId, date, tasks, meetings, scans, hospitalsOfAgent } = params
  const byHospital = new Map<string, Suggestion>()
  const bucket = (id: string | null, name: string) => {
    const key = id ?? '—'
    let s = byHospital.get(key)
    if (!s) {
      s = { hospitalId: id, hospitalName: name, workType: 'field', score: 0, reasons: [] }
      byHospital.set(key, s)
    }
    return s
  }

  for (const t of tasks) {
    if (t.is_done || t.assignee_id !== agentId || !t.due_date) continue
    if (t.due_date === date) {
      const s = bucket(t.hospital_id, t.hospital_name ?? 'ללא בית חולים')
      s.score += t.priority === 'urgent' ? 6 : 4
      s.reasons.push(`משימה ליום זה: ${t.description.slice(0, 40)}`)
    } else if (t.due_date < date && daysBetween(t.due_date, date) <= 7) {
      const s = bucket(t.hospital_id, t.hospital_name ?? 'ללא בית חולים')
      s.score += 2
      s.reasons.push(`משימה שעבר המועד שלה: ${t.description.slice(0, 40)}`)
    }
  }

  for (const m of meetings) {
    if (m.status === 'cancelled' || m.meeting_date !== date || !m.agent_ids.includes(agentId)) continue
    const s = bucket(m.hospital_id, m.hospital_name ?? 'ללא בית חולים')
    s.score += 5
    s.reasons.push(`פגישה קבועה ליום זה: ${m.subject || 'פגישה'}`)
  }

  for (const h of hospitalsOfAgent) {
    let near = 0
    for (const sc of scans) {
      if (sc.hospital_id !== h.id || sc.status === 'cancelled' || sc.status === 'done') continue
      for (const when of [sc.ct_date, sc.surgery_date]) {
        if (!when) continue
        const d = daysBetween(date, when)
        if (d >= 0 && d <= NEAR_DAYS) near++
      }
    }
    if (near > 0) {
      const s = bucket(h.id, h.name)
      s.score += Math.min(near, 4) * 2
      s.reasons.push(near === 1 ? 'סריקת/ניתוח MAKO קרוב בבית החולים' : `${near} סריקות/ניתוחי MAKO קרובים בבית החולים`)
    }
  }

  return [...byHospital.values()].sort((a, b) => b.score - a.score).slice(0, 3)
}

export const WORK_TYPE_SHORT: Record<WorkType, string> = { field: 'שטח', office: 'משרד', training: 'הדרכה', other: 'אחר' }

/** what one cell of the week matrix shows: the day's availability and a short label per shift that has an assignment */
export function assignmentShort(a: Pick<AssignmentRow, 'hospital_id' | 'area' | 'work_type'> | undefined, hospitalName: (id: string) => string | undefined): string {
  if (!a) return ''
  if (a.hospital_id) return hospitalName(a.hospital_id) ?? '?'
  if (a.area) return a.area
  return a.work_type === 'field' ? '' : WORK_TYPE_SHORT[a.work_type]
}

/** the Sunday (yyyy-mm-dd) that holds this date — the key a closed week is stored and looked up by */
export function weekStartOf(dateISO: string): string {
  return weekDates(dateISO)[0]
}

/** the message put in an agent's roster inbox for one shift's assignment, after the week it falls in was closed */
export function assignmentChangeMessage(date: string, shift: RosterShift, a: AssignmentRow | null): string {
  const when = `${SHIFT_LABELS[shift].split(' (')[0]} ${date}`
  if (!a) return `השיבוץ שלך ל${when} בוטל`
  const where = a.hospital_id ? null : a.area || (a.work_type !== 'field' ? WORK_TYPE_LABELS[a.work_type] : '')
  return `השיבוץ שלך ל${when} עודכן${where ? `: ${where}` : ''}`
}
