import { addDays, format, parseISO } from 'date-fns'
import { daysUntil, todayISO } from './utils'

export type ContactState = {
  /** last meeting that already took place */
  lastDate: string | null
  /** next meeting that is already scheduled */
  nextMeeting: string | null
  /** when the next contact is due according to the doctor's cadence */
  dueDate: string | null
  /** negative = days overdue */
  daysToDue: number | null
  /** none = no cadence set · ok · soon = due within a week · due = overdue */
  status: 'none' | 'ok' | 'soon' | 'due'
}

type MeetingLike = {
  meeting_date: string | null
  status: string
  meeting_doctors: { doctor: { id: string } | null }[]
}

/** is it time to meet this doctor again? Based on the cadence set on the doctor and his meetings. */
export function contactState(
  doctor: { id: string; contact_cadence_days: number | null; created_at: string },
  meetings: MeetingLike[],
): ContactState {
  const today = todayISO()
  const mine = meetings.filter(
    (m) => m.meeting_date && m.status !== 'cancelled' && m.meeting_doctors.some((x) => x.doctor?.id === doctor.id),
  )
  // a meeting that took place is one marked done / needs follow-up; a "scheduled" one whose date passed was never closed,
  // so it is no proof of contact (the "now" page asks the agent to update it)
  const past = mine.filter((m) => m.status !== 'scheduled' && (m.meeting_date as string) <= today).map((m) => m.meeting_date as string).sort()
  const future = mine.filter((m) => m.status === 'scheduled' && (m.meeting_date as string) >= today).map((m) => m.meeting_date as string).sort()
  const lastDate = past.length ? past[past.length - 1] : null
  const nextMeeting = future[0] ?? null

  if (!doctor.contact_cadence_days) return { lastDate, nextMeeting, dueDate: null, daysToDue: null, status: 'none' }

  // never met: the clock starts when the doctor was added
  const from = lastDate ?? doctor.created_at.slice(0, 10)
  const dueDate = format(addDays(parseISO(from), doctor.contact_cadence_days), 'yyyy-MM-dd')
  const daysToDue = daysUntil(dueDate)
  // a meeting already booked covers the cadence
  const status: ContactState['status'] = nextMeeting
    ? 'ok'
    : daysToDue !== null && daysToDue < 0
      ? 'due'
      : daysToDue !== null && daysToDue <= 7
        ? 'soon'
        : 'ok'
  return { lastDate, nextMeeting, dueDate, daysToDue, status }
}

export const CADENCE_LABELS: Record<number, string> = {
  7: 'כל שבוע',
  14: 'כל שבועיים',
  30: 'כל חודש',
  60: 'כל חודשיים',
  90: 'כל 3 חודשים',
}
export const cadenceLabel = (days: number | null) => (days ? (CADENCE_LABELS[days] ?? `כל ${days} ימים`) : '')
