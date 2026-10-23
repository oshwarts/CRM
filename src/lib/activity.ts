// "What is going on in the department": the feed of what colleagues did lately (meetings and their summaries, investigations, new doctors,
// changes of stage, processes), the weekly summary and what is new since the person last looked. No data access here.
import { addDays, format } from 'date-fns'

export type ActivityKind = 'meeting' | 'meeting_summary' | 'investigation_open' | 'investigation_closed' | 'doctor' | 'stage' | 'process'

export const KIND_LABELS: Record<ActivityKind, string> = {
  meeting: 'פגישות חדשות',
  meeting_summary: 'סיכומי פגישות',
  investigation_open: 'תחקירים שנפתחו',
  investigation_closed: 'תחקירים שנסגרו',
  doctor: 'רופאים חדשים',
  stage: 'שינויי שלב',
  process: 'תהליכים',
}
export const ALL_KINDS = Object.keys(KIND_LABELS) as ActivityKind[]

export type ActivityItem = {
  id: string
  kind: ActivityKind
  at: string // ISO time
  title: string
  summary: string
  to: string
  actorId: string | null
  actorName: string
  doctors: { id: string; name: string }[]
  hospital: string
}

type Named = { id: string; name: string }
export type FeedInput = {
  names: Record<string, string> // profile id -> name
  meetings: { id: string; subject: string; meeting_date: string | null; status: string; summary: string; decisions: string; created_by: string | null; created_at: string; updated_at: string; hospital: { name: string } | null; meeting_doctors: { doctor: Named | null }[] }[]
  investigations: { id: string; title: string; problem: string; event_date: string; status: string; closed_on: string | null; closed_by: string | null; created_by: string | null; created_at: string; doctors: Named[]; hospital: { name: string } | null }[]
  doctors: { id: string; name: string; title: string; created_at: string; created_by: string | null }[]
  stages: { doctor_id: string; stage: string; previous_stage: string; changed_at: string }[]
  processes: { id: string; name: string; start_date: string; created_at: string; created_by?: string | null }[]
}

const clip = (t: string, max = 160) => {
  const s = t.replace(/\s+/g, ' ').trim()
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}
const HOURS_FOR_SUMMARY = 2

export function buildFeed(i: FeedInput): ActivityItem[] {
  const who = (id: string | null) => (id ? (i.names[id] ?? '') : '')
  const out: ActivityItem[] = []

  for (const m of i.meetings) {
    const text = clip(m.decisions.trim() || m.summary.trim())
    // a summary written after the meeting (not at the moment the meeting was opened) is news of its own
    const later = text && new Date(m.updated_at).getTime() - new Date(m.created_at).getTime() > HOURS_FOR_SUMMARY * 3600_000
    out.push({
      id: `m-${m.id}`,
      kind: later ? 'meeting_summary' : 'meeting',
      at: later ? m.updated_at : m.created_at,
      title: m.subject.trim() || 'פגישה ללא נושא',
      summary: text,
      to: `/meetings/${m.id}`,
      actorId: m.created_by,
      actorName: who(m.created_by),
      doctors: m.meeting_doctors.flatMap((d) => (d.doctor ? [{ id: d.doctor.id, name: d.doctor.name }] : [])),
      hospital: m.hospital?.name ?? '',
    })
  }
  for (const v of i.investigations) {
    out.push({ id: `i-${v.id}`, kind: 'investigation_open', at: v.created_at, title: v.title.trim() || 'תחקיר ללא כותרת', summary: clip(v.problem), to: '/investigations', actorId: v.created_by, actorName: who(v.created_by), doctors: v.doctors, hospital: v.hospital?.name ?? '' })
    if (v.status === 'closed' && v.closed_on) {
      out.push({ id: `ic-${v.id}`, kind: 'investigation_closed', at: `${v.closed_on}T12:00:00`, title: v.title.trim() || 'תחקיר ללא כותרת', summary: '', to: '/investigations', actorId: v.closed_by, actorName: who(v.closed_by), doctors: v.doctors, hospital: v.hospital?.name ?? '' })
    }
  }
  for (const d of i.doctors) {
    out.push({ id: `d-${d.id}`, kind: 'doctor', at: d.created_at, title: `${d.title} ${d.name}`.trim(), summary: '', to: `/doctors/${d.id}`, actorId: d.created_by, actorName: who(d.created_by), doctors: [{ id: d.id, name: d.name }], hospital: '' })
  }
  const doctorName = new Map(i.doctors.map((d) => [d.id, `${d.title} ${d.name}`.trim()]))
  for (const s of i.stages) {
    // the first stage of a new doctor is not a "change"
    if (!s.previous_stage) continue
    out.push({ id: `s-${s.doctor_id}-${s.changed_at}`, kind: 'stage', at: s.changed_at, title: doctorName.get(s.doctor_id) ?? 'רופא', summary: `${s.previous_stage} ← ${s.stage}`, to: `/doctors/${s.doctor_id}`, actorId: null, actorName: '', doctors: [{ id: s.doctor_id, name: doctorName.get(s.doctor_id) ?? '' }], hospital: '' })
  }
  for (const p of i.processes) {
    out.push({ id: `p-${p.id}`, kind: 'process', at: p.created_at, title: p.name, summary: '', to: `/processes/${p.id}`, actorId: p.created_by ?? null, actorName: who(p.created_by ?? null), doctors: [], hospital: '' })
  }
  return out.sort((a, b) => b.at.localeCompare(a.at))
}

export type FeedFilters = { kinds: ActivityKind[]; q: string; doctorId: string; days: number }
export const defaultFeedFilters: FeedFilters = { kinds: ALL_KINDS, q: '', doctorId: '', days: 30 }

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
const dayStart = (today: string, days: number) => format(addDays(new Date(`${today}T12:00:00`), -days), 'yyyy-MM-dd')

export function filterFeed(items: ActivityItem[], f: FeedFilters, today: string): ActivityItem[] {
  const since = dayStart(today, f.days)
  const words = norm(f.q).split(' ').filter(Boolean)
  return items.filter((it) => {
    if (it.at.slice(0, 10) < since) return false
    if (!f.kinds.includes(it.kind)) return false
    if (f.doctorId && !it.doctors.some((d) => d.id === f.doctorId)) return false
    if (words.length) {
      const hay = norm(`${it.title} ${it.summary} ${it.actorName} ${it.hospital} ${it.doctors.map((d) => d.name).join(' ')}`)
      if (!words.every((w) => hay.includes(w))) return false
    }
    return true
  })
}

/** new for this person: after the time he last looked, not his own doing, and of a kind he wants to hear about */
export function unreadItems(items: ActivityItem[], seenAt: string, me: string | null | undefined, kinds: ActivityKind[]): ActivityItem[] {
  return items.filter((it) => it.at > seenAt && it.actorId !== me && kinds.includes(it.kind))
}

export function groupByDay(items: ActivityItem[]): { day: string; items: ActivityItem[] }[] {
  const out: { day: string; items: ActivityItem[] }[] = []
  for (const it of items) {
    const day = it.at.slice(0, 10)
    const last = out.at(-1)
    if (last && last.day === day) last.items.push(it)
    else out.push({ day, items: [it] })
  }
  return out
}

export type WeekSummary = {
  from: string
  counts: Record<ActivityKind, number>
  total: number
  busiest: { name: string; count: number }[]
  hospitals: { name: string; count: number }[]
}

/** the last 7 days at a glance: how many of each, who and which hospitals were most active */
export function weekSummary(items: ActivityItem[], today: string): WeekSummary {
  const from = dayStart(today, 6)
  const week = items.filter((it) => it.at.slice(0, 10) >= from)
  const counts = Object.fromEntries(ALL_KINDS.map((k) => [k, 0])) as Record<ActivityKind, number>
  const people = new Map<string, number>()
  const hospitals = new Map<string, number>()
  for (const it of week) {
    counts[it.kind]++
    if (it.actorName) people.set(it.actorName, (people.get(it.actorName) ?? 0) + 1)
    if (it.hospital && (it.kind === 'meeting' || it.kind === 'meeting_summary')) hospitals.set(it.hospital, (hospitals.get(it.hospital) ?? 0) + 1)
  }
  const top = (m: Map<string, number>) => [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'he')).slice(0, 3)
  return { from, counts, total: week.length, busiest: top(people), hospitals: top(hospitals) }
}
