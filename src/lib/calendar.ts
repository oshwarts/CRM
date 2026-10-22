// The calendar: views (day / week / month), the range each one shows, and the layout of events in a day (overlapping events side by side).
import { addDays, addMonths, endOfMonth, format, startOfMonth, startOfWeek } from 'date-fns'

export type CalView = 'day' | 'week' | 'month'

export const iso = (d: Date) => format(d, 'yyyy-MM-dd')
export const parseISO = (s: string) => new Date(`${s}T12:00:00`)
/** "09:30" -> 570 */
export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
export const fromMinutes = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`

/** the weeks (Sunday first) that cover the month of `anchor`, every week a list of seven days */
export function monthWeeks(anchor: Date): Date[][] {
  const first = startOfWeek(startOfMonth(anchor), { weekStartsOn: 0 })
  const last = endOfMonth(anchor)
  const weeks: Date[][] = []
  for (let start = first; start <= last; start = addDays(start, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, i)))
  return weeks
}

/** the days a view shows, and the first and last day of the range to load events for */
export function rangeFor(view: CalView, anchor: Date): { days: Date[]; from: string; to: string } {
  if (view === 'day') return { days: [anchor], from: iso(anchor), to: iso(anchor) }
  if (view === 'week') {
    const start = startOfWeek(anchor, { weekStartsOn: 0 })
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
    return { days, from: iso(days[0]), to: iso(days[6]) }
  }
  const weeks = monthWeeks(anchor)
  const days = weeks.flat()
  return { days, from: iso(days[0]), to: iso(days[days.length - 1]) }
}

/** one step back (-1) or forward (+1): a day, a week or a month */
export function shiftAnchor(view: CalView, anchor: Date, dir: -1 | 1): Date {
  if (view === 'day') return addDays(anchor, dir)
  if (view === 'week') return addDays(anchor, 7 * dir)
  return addMonths(anchor, dir)
}

const monthName = (d: Date) => new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(d)
const weekday = (d: Date) => new Intl.DateTimeFormat('he-IL', { weekday: 'long' }).format(d)

/** the title above the calendar: "יום חמישי, 22/10/2026", "18/10 – 24/10/2026" or "אוקטובר 2026" */
export function titleFor(view: CalView, anchor: Date): string {
  if (view === 'day') return `${weekday(anchor)}, ${format(anchor, 'dd/MM/yyyy')}`
  if (view === 'week') {
    const { days } = rangeFor('week', anchor)
    return `${format(days[0], 'dd/MM')} – ${format(days[6], 'dd/MM/yyyy')}`
  }
  return monthName(anchor)
}

export type Timed = { id: string; start: number; end: number }

/** side-by-side placement of events that overlap: each gets a column and the number of columns of its group */
export function layoutOverlaps(events: Timed[]): Map<string, { col: number; cols: number }> {
  const sorted = [...events].sort((a, b) => a.start - b.start || b.end - a.end)
  const out = new Map<string, { col: number; cols: number }>()
  let group: Timed[] = []
  let groupEnd = -1
  const flush = () => {
    if (group.length === 0) return
    const colEnds: number[] = []
    const placed = group.map((e) => {
      let col = colEnds.findIndex((end) => end <= e.start)
      if (col === -1) col = colEnds.length
      colEnds[col] = e.end
      return { id: e.id, col }
    })
    for (const p of placed) out.set(p.id, { col: p.col, cols: colEnds.length })
    group = []
  }
  for (const e of sorted) {
    if (e.start >= groupEnd) {
      flush()
      groupEnd = e.end
    } else groupEnd = Math.max(groupEnd, e.end)
    group.push(e)
  }
  flush()
  return out
}

/** the hours the time grid shows: 07:00-20:00 at least, wider when an event lies outside */
export function hourRange(events: Timed[]): { from: number; to: number } {
  let from = 7
  let to = 20
  for (const e of events) {
    from = Math.min(from, Math.floor(e.start / 60))
    to = Math.max(to, Math.ceil(e.end / 60))
  }
  return { from: Math.max(0, from), to: Math.min(24, to) }
}
