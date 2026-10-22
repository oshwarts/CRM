// What the calendar shows: every source (meetings, MAKO scans, surgeries entered by hand, tasks) turned into one list of items,
// the lines that add up, and the filters of the screen. Pure functions — the screen only draws what comes out.
import type { useMeetings, usePatientScans, useTasks } from './api'
import type { PlannedSurgery } from './plannedSurgeries'
import { SCAN_PROCEDURE_LABELS } from './types'
import type { Item, Kind } from '../components/schedule/shared'

type Meeting = NonNullable<ReturnType<typeof useMeetings>['data']>[number]
type Scan = NonNullable<ReturnType<typeof usePatientScans>['data']>[number]
type Task = NonNullable<ReturnType<typeof useTasks>['data']>[number]

export const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '')

export type ScheduleSources = {
  meetings: Meeting[]
  scans: Scan[]
  planned: PlannedSurgery[]
  tasks: Task[]
  /** hospital id -> the agents responsible for it (scans have no agent of their own) */
  agentsOfHospital: Map<string, string[]>
}

/** meetings (and their follow-up dates); cancelled ones stay out, done ones are muted */
function meetingItems(meetings: Meeting[]): Item[] {
  const out: Item[] = []
  for (const m of meetings) {
    if (m.status === 'cancelled') continue
    const who = [
      ...m.meeting_doctors.flatMap((d) => (d.doctor ? [`${d.doctor.title} ${d.doctor.name}`] : [])),
      ...m.meeting_contacts.flatMap((c) => (c.contact ? [c.contact.name] : [])),
    ].join(', ')
    const sub = [m.hospital?.name, who].filter(Boolean).join(' · ')
    const agentIds = [...(m.responsible_agent_id ? [m.responsible_agent_id] : []), ...m.meeting_agents.flatMap((a) => (a.agent ? [a.agent.id] : []))]
    if (m.meeting_date)
      out.push({
        id: `m-${m.id}`, date: m.meeting_date, time: hhmm(m.meeting_time), durationMin: 60, kind: 'meeting',
        title: m.subject || 'פגישה', sub, to: `/meetings/${m.id}`, muted: m.status === 'done', agentIds,
      })
    if (m.next_followup_date && m.status !== 'done')
      out.push({
        id: `f-${m.id}`, date: m.next_followup_date, time: '', kind: 'followup',
        title: `מעקב: ${m.subject || 'פגישה'}`, sub, to: `/meetings/${m.id}`, agentIds,
      })
  }
  return out
}

/** MAKO scans: a CT line and a rescan line each, and the surgeries of the same surgeon, hospital, day and type add up to ONE line */
function scanItems(scans: Scan[], agentsOfHospital: Map<string, string[]>): Item[] {
  const out: Item[] = []
  const groups = new Map<string, { date: string; proc: string; base: string; link: string; ag: string[]; n: number; done: number; one: { side: string; patient: string } }>()
  for (const s of scans) {
    if (s.status === 'cancelled') continue
    const ag = agentsOfHospital.get(s.hospital_id) ?? []
    const proc = SCAN_PROCEDURE_LABELS[s.procedure_type] ?? ''
    const surgeon = s.surgeon ? `${s.surgeon.title} ${s.surgeon.name}` : ''
    const base = [s.hospital?.name, surgeon].filter(Boolean).join(' · ')
    const link = `/scans?hospital=${s.hospital_id}&window=all&highlight=${s.id}`
    if (s.surgery_date) {
      const key = `${s.surgeon_id ?? ''}|${s.hospital_id}|${s.surgery_date}|${s.procedure_type}`
      const g = groups.get(key) ?? { date: s.surgery_date, proc, base, link, ag, n: 0, done: 0, one: { side: s.side, patient: s.patient_name } }
      g.n++
      if (s.status === 'done') g.done++
      groups.set(key, g)
    }
    if (s.ct_date)
      out.push({
        id: `c-${s.id}`, date: s.ct_date, time: hhmm(s.ct_time), durationMin: 30, kind: 'ct',
        title: `CT – ${s.patient_name}`, sub: base, to: link, muted: s.scanned, agentIds: ag,
      })
    if (s.rescan && !s.rescan_done && s.rescan_date)
      out.push({
        id: `r-${s.id}`, date: s.rescan_date, time: '', kind: 'rescan',
        title: `סריקה חוזרת – ${s.patient_name}`, sub: [s.rescan_reason, base].filter(Boolean).join(' · '), to: link, agentIds: ag,
      })
  }
  for (const [key, g] of groups)
    out.push({
      id: `s-${key}`, date: g.date, time: '', kind: 'surgery',
      title: g.n > 1 ? `${g.n} × ${g.proc} MAKO` : `${g.proc} MAKO${g.one.side ? ` ${g.one.side}` : ''} – ${g.one.patient}`,
      sub: g.base, to: g.link, muted: g.done === g.n, agentIds: g.ag,
    })
  return out
}

/** surgeries entered by hand: the same surgeon, hospital, day and type add up to one line (the cases are summed, the earliest hour wins) */
export function plannedItems(planned: PlannedSurgery[]): Item[] {
  const entered = new Map<string, { rows: PlannedSurgery[]; cases: number; time: string; done: boolean; notes: string[]; agents: string[] }>()
  for (const x of planned) {
    if (x.status === 'cancelled') continue
    const key = `${x.doctor_id ?? ''}|${x.hospital_id ?? ''}|${x.surgery_date}|${x.procedure.trim().toLowerCase()}`
    const e = entered.get(key) ?? { rows: [], cases: 0, time: '', done: true, notes: [], agents: [] }
    e.rows.push(x)
    e.cases += x.cases ?? 1
    const t = hhmm(x.surgery_time)
    if (t && (!e.time || t < e.time)) e.time = t
    if (x.status !== 'done') e.done = false
    if (x.notes && !e.notes.includes(x.notes)) e.notes.push(x.notes)
    if (x.agent_id && !e.agents.includes(x.agent_id)) e.agents.push(x.agent_id)
    entered.set(key, e)
  }
  return [...entered.values()].map((e) => {
    const x = e.rows[0]
    const doctor = x.doctor ? `${x.doctor.title} ${x.doctor.name}` : ''
    return {
      id: `p-${x.id}`, date: x.surgery_date, time: e.time, kind: 'surgery' as const,
      title: [e.cases > 1 ? `${e.cases} ×` : '', x.procedure.trim() || 'ניתוח', x.company ? `· ${x.company}` : ''].filter(Boolean).join(' '),
      sub: [x.hospital?.name, doctor, ...e.notes].filter(Boolean).join(' · '), to: '', surgery: x, group: e.rows,
      muted: e.done, agentIds: e.agents,
    }
  })
}

/** open tasks with a due date: an all-day line with the type "משימה" */
function taskItems(tasks: Task[]): Item[] {
  const out: Item[] = []
  for (const t of tasks) {
    if (t.is_done || !t.due_date) continue
    out.push({
      id: `t-${t.id}`, date: t.due_date, time: '', kind: 'task', title: t.description,
      sub: [t.doctor ? `${t.doctor.title} ${t.doctor.name}` : '', t.hospital?.name].filter(Boolean).join(' · '), to: '', task: t,
      agentIds: t.assignee_id ? [t.assignee_id] : [],
    })
  }
  return out
}

export function buildItems(src: ScheduleSources): Item[] {
  return [...meetingItems(src.meetings), ...scanItems(src.scans, src.agentsOfHospital), ...plannedItems(src.planned), ...taskItems(src.tasks)]
}

/** inside the range (inclusive, `yyyy-MM-dd`), of the chosen agent when there is one */
function inRange(items: Item[], from: string, to: string, agentId: string): Item[] {
  return items.filter((it) => it.date >= from && it.date <= to && (!agentId || it.agentIds.includes(agentId)))
}

/** what the calendar draws: the kinds switched on, by day, then hour (no hour last), then kind */
export function visibleItems(items: Item[], from: string, to: string, shown: Record<Kind, boolean>, agentId: string): Item[] {
  return inRange(items, from, to, agentId)
    .filter((it) => shown[it.kind])
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '99').localeCompare(b.time || '99') || a.kind.localeCompare(b.kind))
}

/** how many of each kind the range holds (for the agent chosen) — the numbers on the type chips */
export function countKinds(items: Item[], from: string, to: string, agentId: string): Record<Kind, number> {
  const c: Record<Kind, number> = { meeting: 0, surgery: 0, ct: 0, rescan: 0, followup: 0, task: 0 }
  for (const it of inRange(items, from, to, agentId)) c[it.kind]++
  return c
}
