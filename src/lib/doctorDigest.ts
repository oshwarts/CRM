// "What is new with this doctor": a summary of the last month / quarter / half year / year, made from the data of the system
// (meetings, surgeries, investigations, stage changes, tasks). Nothing here is sent anywhere and nothing is written by an AI.
import { addDays, format } from 'date-fns'

export type DigestPeriod = 'month' | 'quarter' | 'half' | 'year'

export const PERIOD_LABELS: Record<DigestPeriod, string> = { month: 'חודש', quarter: 'רבעון', half: 'חצי שנה', year: 'שנה' }
export const PERIOD_DAYS: Record<DigestPeriod, number> = { month: 30, quarter: 91, half: 182, year: 365 }

type MeetingIn = { id: string; subject: string; meeting_date: string | null; status: string; summary: string; decisions: string; competitor_notes: string }
type ScanIn = { surgery_date: string | null; status: string; surgeon_id: string | null }
type InvestigationIn = { id: string; title: string; event_date: string; status: string; closed_on: string | null; root_cause: string; solution: string }
type StageIn = { stage: string; previous_stage: string; changed_at: string }
type TaskIn = { is_done: boolean; due_date: string | null }

export type DigestInput = {
  doctorId: string
  today: string
  meetings: MeetingIn[]
  scans: ScanIn[]
  investigations: InvestigationIn[]
  stages: StageIn[]
  tasks: TaskIn[]
}

export type Alert = { level: 'warn' | 'info'; text: string }

export type Digest = {
  from: string
  to: string
  meetings: { count: number; previous: number; lastDate: string | null; recent: { id: string; date: string; subject: string; note: string }[]; competitorMentions: number }
  surgeries: { done: number; previous: number; postponed: number; cancelled: number; upcoming: number }
  investigations: { opened: number; closed: number; openNow: number; list: InvestigationIn[] }
  stages: { count: number; list: { stage: string; previous: string; date: string }[] }
  tasks: { overdue: number; open: number }
  alerts: Alert[]
}

const iso = (d: Date) => format(d, 'yyyy-MM-dd')
const shift = (day: string, n: number) => iso(addDays(new Date(`${day}T12:00:00`), n))
const within = (day: string | null | undefined, from: string, to: string) => !!day && day.slice(0, 10) >= from && day.slice(0, 10) <= to

/** the first line of what was written about a meeting: the decisions first, else the summary, cut to a readable length */
export function meetingNote(m: Pick<MeetingIn, 'summary' | 'decisions'>, max = 140): string {
  const text = (m.decisions.trim() || m.summary.trim()).replace(/\s+/g, ' ')
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export function buildDigest(input: DigestInput, period: DigestPeriod): Digest {
  const days = PERIOD_DAYS[period]
  const to = input.today
  const from = shift(to, -(days - 1))
  const prevTo = shift(from, -1)
  const prevFrom = shift(prevTo, -(days - 1))

  // meetings that happened (not cancelled, not in the future)
  const held = input.meetings.filter((m) => m.status !== 'cancelled' && m.meeting_date && m.meeting_date <= to)
  const inPeriod = held.filter((m) => within(m.meeting_date, from, to)).sort((a, b) => (b.meeting_date ?? '').localeCompare(a.meeting_date ?? ''))
  const lastDate = held.reduce<string | null>((best, m) => (!best || (m.meeting_date ?? '') > best ? m.meeting_date : best), null)

  const mine = input.scans.filter((s) => s.surgeon_id === input.doctorId)
  const done = (a: string, b: string) => mine.filter((s) => s.status === 'done' && within(s.surgery_date, a, b)).length
  const surgeries = {
    done: done(from, to),
    previous: done(prevFrom, prevTo),
    postponed: mine.filter((s) => s.status === 'postponed' && within(s.surgery_date, from, to)).length,
    cancelled: mine.filter((s) => s.status === 'cancelled' && within(s.surgery_date, from, to)).length,
    upcoming: mine.filter((s) => s.status === 'planned' && within(s.surgery_date, to, shift(to, 30))).length,
  }

  const invList = input.investigations.filter((i) => within(i.event_date, from, to) || within(i.closed_on, from, to) || i.status === 'open')
  const investigations = {
    opened: input.investigations.filter((i) => within(i.event_date, from, to)).length,
    closed: input.investigations.filter((i) => within(i.closed_on, from, to)).length,
    openNow: input.investigations.filter((i) => i.status === 'open').length,
    list: invList,
  }

  const stageList = input.stages.filter((s) => within(s.changed_at, from, to)).map((s) => ({ stage: s.stage, previous: s.previous_stage, date: s.changed_at.slice(0, 10) }))
  const open = input.tasks.filter((t) => !t.is_done)
  const tasks = { open: open.length, overdue: open.filter((t) => t.due_date && t.due_date < to).length }

  const alerts: Alert[] = []
  if (lastDate === null) alerts.push({ level: 'warn', text: 'עדיין לא הייתה פגישה עם הרופא' })
  else {
    const since = Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${lastDate}T12:00:00`).getTime()) / 86400000)
    if (since > 60) alerts.push({ level: 'warn', text: `לא הייתה פגישה כבר ${since} ימים` })
  }
  if (investigations.openNow > 0) alerts.push({ level: 'warn', text: investigations.openNow === 1 ? 'יש תחקיר פתוח' : `יש ${investigations.openNow} תחקירים פתוחים` })
  if (surgeries.previous >= 2 && surgeries.done < surgeries.previous / 2) alerts.push({ level: 'warn', text: `ירידה בניתוחים: ${surgeries.done} לעומת ${surgeries.previous} בתקופה הקודמת` })
  if (surgeries.postponed + surgeries.cancelled >= 2) alerts.push({ level: 'warn', text: `${surgeries.postponed + surgeries.cancelled} ניתוחים נדחו או בוטלו בתקופה` })
  if (tasks.overdue > 0) alerts.push({ level: 'warn', text: tasks.overdue === 1 ? 'משימה אחת באיחור' : `${tasks.overdue} משימות באיחור` })
  if (surgeries.previous >= 2 && surgeries.done > surgeries.previous * 1.5) alerts.push({ level: 'info', text: `עלייה בניתוחים: ${surgeries.done} לעומת ${surgeries.previous} בתקופה הקודמת` })

  return {
    from,
    to,
    meetings: {
      count: inPeriod.length,
      previous: held.filter((m) => within(m.meeting_date, prevFrom, prevTo)).length,
      lastDate,
      recent: inPeriod.slice(0, 5).map((m) => ({ id: m.id, date: m.meeting_date ?? '', subject: m.subject, note: meetingNote(m) })),
      competitorMentions: inPeriod.filter((m) => m.competitor_notes.trim()).length,
    },
    surgeries,
    investigations,
    stages: { count: stageList.length, list: stageList },
    tasks,
    alerts,
  }
}

export type RosterInput = {
  today: string
  doctors: { id: string; name: string; title: string; status: string }[]
  meetings: (MeetingIn & { doctorIds: string[] })[]
  scans: ScanIn[]
  investigations: (InvestigationIn & { doctor_id: string })[]
  stages: (StageIn & { doctor_id: string })[]
  tasks: (TaskIn & { doctor_id: string | null })[]
}

export type RosterRow = { doctor: RosterInput['doctors'][number]; digest: Digest; warnings: number }

const groupBy = <T,>(rows: T[], keys: (r: T) => (string | null | undefined)[]) => {
  const m = new Map<string, T[]>()
  for (const r of rows) for (const k of keys(r)) if (k) (m.get(k) ?? m.set(k, []).get(k)!).push(r)
  return m
}

/** the digest of every doctor, most things to look at first (rows are grouped by doctor once, not searched for each doctor) */
export function buildRoster(input: RosterInput, period: DigestPeriod): RosterRow[] {
  const meetings = groupBy(input.meetings, (m) => m.doctorIds)
  const scans = groupBy(input.scans, (s) => [s.surgeon_id])
  const investigations = groupBy(input.investigations, (i) => [i.doctor_id])
  const stages = groupBy(input.stages, (s) => [s.doctor_id])
  const tasks = groupBy(input.tasks, (t) => [t.doctor_id])
  return input.doctors
    .map((doctor) => {
      const digest = buildDigest(
        {
          doctorId: doctor.id,
          today: input.today,
          meetings: meetings.get(doctor.id) ?? [],
          scans: scans.get(doctor.id) ?? [],
          investigations: investigations.get(doctor.id) ?? [],
          stages: stages.get(doctor.id) ?? [],
          tasks: tasks.get(doctor.id) ?? [],
        },
        period,
      )
      return { doctor, digest, warnings: digest.alerts.filter((a) => a.level === 'warn').length }
    })
    .sort((a, b) => b.warnings - a.warnings || a.doctor.name.localeCompare(b.doctor.name, 'he'))
}
