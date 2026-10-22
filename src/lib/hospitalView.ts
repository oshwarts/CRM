// Pure logic of the hospital page (/hospitals/:id): which meetings count as held, case volumes by year, the surgeries list.
import { HELD_MEETING } from './agentMetrics'

type MeetingLike = { meeting_date: string | null; status: string }

/** a meeting that really took place: held (done / needs follow-up) and not in the future. A meeting that is still "scheduled" never counts, even when its date has passed. */
export const isHeldMeeting = (m: MeetingLike, today: string) => !!m.meeting_date && m.meeting_date <= today && HELD_MEETING.has(m.status)

/** held meetings, newest first */
export function heldMeetings<T extends MeetingLike>(meetings: T[], today: string): T[] {
  return meetings.filter((m) => isHeldMeeting(m, today)).sort((a, b) => (b.meeting_date as string).localeCompare(a.meeting_date as string))
}

/** the nearest meeting that is still ahead (today included), if it is scheduled */
export function nextMeeting<T extends MeetingLike>(meetings: T[], today: string): T | null {
  return (
    meetings
      .filter((m) => m.status === 'scheduled' && !!m.meeting_date && m.meeting_date >= today)
      .sort((a, b) => (a.meeting_date as string).localeCompare(b.meeting_date as string))[0] ?? null
  )
}

/** the date of the last held meeting with each doctor (any hospital) */
export function lastMetByDoctor(meetings: (MeetingLike & { meeting_doctors: { doctor: { id: string } | null }[] })[], today: string): Map<string, string> {
  const m = new Map<string, string>()
  for (const mt of meetings)
    if (isHeldMeeting(mt, today)) for (const d of mt.meeting_doctors) if (d.doctor && (m.get(d.doctor.id) ?? '') < (mt.meeting_date as string)) m.set(d.doctor.id, mt.meeting_date as string)
  return m
}

export type VolumeRow = { name: string; now: number; prev: number }

/** case volumes of the latest year next to the year before it (the years need not be consecutive), by procedure, biggest first */
export function volumeComparison(volumes: { year: number; count: number; procedure: { name: string } | null }[]): { year: number | null; prevYear: number | null; rows: VolumeRow[] } {
  const years = [...new Set(volumes.map((v) => v.year))].sort((a, b) => b - a)
  const [year = null, prevYear = null] = years
  const by = new Map<string, VolumeRow>()
  for (const v of volumes) {
    if (v.year !== year && v.year !== prevYear) continue
    const name = v.procedure?.name ?? '—'
    const cur = by.get(name) ?? { name, now: 0, prev: 0 }
    if (v.year === year) cur.now += v.count
    else cur.prev += v.count
    by.set(name, cur)
  }
  const rows = [...by.values()].filter((r) => r.now > 0 || r.prev > 0).sort((a, b) => b.now - a.now || a.name.localeCompare(b.name, 'he'))
  return { year, prevYear, rows }
}

export type SurgeryRow = { key: string; date: string; surgeon: string; what: string; cases: number; status: string }

/** the rows to show: what is still planned (soonest first), then the newest of everything else (at most `past`) */
export function surgeryList(rows: SurgeryRow[], today: string, past = 20): { upcoming: SurgeryRow[]; shown: SurgeryRow[] } {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date))
  const upcoming = sorted.filter((s) => s.date >= today && s.status === 'planned')
  const rest = sorted.filter((s) => !upcoming.includes(s)).reverse().slice(0, past)
  return { upcoming, shown: [...upcoming, ...rest] }
}

/** a tel: link holds only what a dialer understands (digits, +, *, #, pause) — spaces and dashes typed by people are dropped */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+*#,;]/g, '')}`
/** a mailto: link without the spaces a person may have typed */
export const mailHref = (email: string) => `mailto:${email.replace(/\s/g, '')}`
