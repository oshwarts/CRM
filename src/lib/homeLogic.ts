import type { MeetingWithRelations, PatientScanRow } from './types'
import { rescanAlert, weekMissing, type RescanKind } from './scanAlerts'
import { daysUntil } from './utils'

/* The pure logic of the home page (Home.tsx, TodayBlock.tsx): what is "mine", the scan alerts, the follow-up of favourite doctors,
   the reminders — and the Hebrew number words that were wrong for 1 ("1 פגישות", "לפני 1 ימים"). Every date is a local yyyy-mm-dd. */

/** a meeting is mine when I am responsible, I am one of its agents, or nobody was made responsible (then it is everybody's) */
export function isMyMeeting(m: Pick<MeetingWithRelations, 'responsible_agent_id' | 'meeting_agents'>, userId: string | undefined): boolean {
  return !m.responsible_agent_id || m.responsible_agent_id === userId || m.meeting_agents.some((a) => a.agent?.id === userId)
}

/** the surgery window of the scans block: the saved choice, defended against a stale or hand-made value */
export function surgeryWindowEnd(range: '7' | '14' | '30' | 'date', until: string, today: string, plusDays: (n: number) => string): string {
  if (range !== 'date') return plusDays(Number(range))
  // a date in the past (saved yesterday, or typed) would empty the whole block: fall back to a week
  return /^\d{4}-\d{2}-\d{2}$/.test(until) && until >= today ? until : plusDays(7)
}

export type ScanAlerts = {
  upcoming: PatientScanRow[]
  overdue: PatientScanRow[]
  noCtSoon: PatientScanRow[]
  noDiskSoon: PatientScanRow[]
  weekOpen: { s: PatientScanRow; missing: string[] }[]
  rescans: { s: PatientScanRow; kind: RescanKind }[]
}

const byDate = (key: 'ct_date' | 'surgery_date') => (a: PatientScanRow, b: PatientScanRow) => (a[key] ?? '').localeCompare(b[key] ?? '')

/** the alerts of the scans block; every list is ordered with the most urgent first (the block shows only the first few) */
export function scanAlerts(list: PatientScanRow[], today: string, surgeryUntil: string): ScanAlerts {
  const active = list.filter((s) => s.status !== 'cancelled')
  const surgerySoon = (s: PatientScanRow) => !!s.surgery_date && s.surgery_date >= today && s.surgery_date <= surgeryUntil
  return {
    upcoming: list.filter((s) => s.ct_date && s.ct_date >= today && (daysUntil(s.ct_date) ?? 99) <= 7 && !s.scanned).sort(byDate('ct_date')),
    overdue: list.filter((s) => s.ct_date && s.ct_date < today && !s.scanned && s.status !== 'cancelled'),
    // surgery within the window, and no CT date arranged yet
    noCtSoon: active.filter((s) => surgerySoon(s) && !s.ct_date).sort(byDate('surgery_date')),
    // surgery within the window, there is a CT but the disk was not uploaded
    noDiskSoon: active.filter((s) => surgerySoon(s) && !!s.ct_date && !s.disk_collected).sort(byDate('surgery_date')),
    // a CT this coming week that still misses something (not done / disk / plan)
    weekOpen: list.map((s) => ({ s, missing: weekMissing(s) })).filter((x) => x.missing.length > 0).sort((a, b) => byDate('ct_date')(a.s, b.s)),
    // open re-scans: make sure the patient arrives
    rescans: list
      .map((s) => ({ s, kind: rescanAlert(s) }))
      .filter((x): x is { s: PatientScanRow; kind: RescanKind } => x.kind !== null)
      .sort((a, b) => (a.s.rescan_date ?? '').localeCompare(b.s.rescan_date ?? '')),
  }
}

export type DoctorMeetingInfo = { last?: string; next?: string; followup?: string; followupFrom?: string }

/** per doctor: the last meeting that took place, the next scheduled one, and the follow-up date recorded on the latest meeting */
export function meetingInfoByDoctor(meetings: MeetingWithRelations[], today: string): Map<string, DoctorMeetingInfo> {
  const map = new Map<string, DoctorMeetingInfo>()
  for (const m of meetings) {
    if (!m.meeting_date || m.status === 'cancelled') continue
    const upcoming = m.meeting_date >= today && m.status !== 'done'
    for (const md of m.meeting_doctors) {
      if (!md.doctor) continue
      const cur = map.get(md.doctor.id) ?? {}
      if (upcoming) {
        if (!cur.next || m.meeting_date < cur.next) cur.next = m.meeting_date
      } else if (m.status !== 'scheduled' && (!cur.last || m.meeting_date > cur.last)) {
        // (a "scheduled" meeting whose date passed was never closed — it is not a meeting that took place)
        cur.last = m.meeting_date
        cur.followupFrom = m.meeting_date
        cur.followup = m.next_followup_date ?? undefined
      }
      map.set(md.doctor.id, cur)
    }
  }
  return map
}

export type FollowStatus = 'overdue' | 'none' | 'soon' | 'later'
const RANK: Record<FollowStatus, number> = { overdue: 0, none: 1, soon: 2, later: 3 }

/** follow-up of the favourite doctors: overdue → not scheduled yet → coming up (a week) → later */
export function favFollowUp<D extends { id: string }>(docs: D[], info: Map<string, DoctorMeetingInfo>, today: string) {
  return docs
    .map((d) => {
      const i = info.get(d.id)
      const nextDate = i?.next ?? i?.followup
      const status: FollowStatus = !nextDate ? 'none' : nextDate < today ? 'overdue' : (daysUntil(nextDate) ?? 99) <= 7 ? 'soon' : 'later'
      return { d, info: i, nextDate, isFollowup: !i?.next && !!i?.followup, status }
    })
    .sort(
      (a, b) =>
        RANK[a.status] - RANK[b.status] ||
        // among the unscheduled, the one not met for the longest time comes first
        (a.status === 'none' ? (a.info?.last ?? '').localeCompare(b.info?.last ?? '') : (a.nextDate ?? '').localeCompare(b.nextDate ?? '')),
    )
}

const byDateTime = (a: MeetingWithRelations, b: MeetingWithRelations) =>
  `${a.meeting_date}${a.meeting_time ?? ''}`.localeCompare(`${b.meeting_date}${b.meeting_time ?? ''}`)

/** reminders: scheduled meetings in the coming week, and ones whose date passed without being closed */
export function meetingReminders(meetings: MeetingWithRelations[], userId: string | undefined, today: string, weekEnd: string) {
  const open = meetings.filter((m) => m.meeting_date && m.status === 'scheduled' && isMyMeeting(m, userId))
  return {
    soon: open.filter((m) => m.meeting_date! >= today && m.meeting_date! <= weekEnd).sort(byDateTime),
    missed: open.filter((m) => m.meeting_date! < today).sort(byDateTime),
  }
}

/** my meetings (not cancelled) on one of the given days, by date and time */
export function meetingsOnDays(meetings: MeetingWithRelations[], days: string[], userId: string | undefined) {
  return meetings
    .filter((m) => m.meeting_date && days.includes(m.meeting_date) && m.status !== 'cancelled' && isMyMeeting(m, userId))
    .sort(byDateTime)
}

/* ---------- Hebrew number words ---------- */

/** "פגישה אחת" / "3 פגישות" */
export const countWord = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`)

/** how long ago a past date was, from `daysUntil` of it (negative or 0) */
export function agoLabel(daysAgo: number): string {
  if (daysAgo <= 0) return 'היום'
  if (daysAgo === 1) return 'אתמול'
  return `לפני ${daysAgo} ימים`
}

/** in how many days (0 = today) */
export function inDaysLabel(n: number): string {
  if (n <= 0) return 'היום'
  if (n === 1) return 'מחר'
  if (n === 2) return 'בעוד יומיים'
  return `בעוד ${n} ימים`
}

/** "באיחור של יום" / "באיחור של 5 ימים" */
export function lateByLabel(days: number): string {
  if (days <= 1) return 'באיחור של יום'
  if (days === 2) return 'באיחור של יומיים'
  return `באיחור של ${days} ימים`
}

/** the sentence for a refused or failed silent save ("what" = e.g. "עדכון המועדפים"): the reason is added when the server gave one */
export function failText(e: unknown, what: string, offlineMessage: string): string {
  const msg = typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : ''
  if (msg === offlineMessage) return 'אין חיבור לרשת — השינוי לא נשמר'
  return msg ? `${what} נכשל: ${msg}` : `${what} נכשל`
}
