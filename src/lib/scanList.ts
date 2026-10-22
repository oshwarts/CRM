// What the scans screen shows when it opens: the surgeries of the next one or two weeks, nearest first, and not the old ones that were done.
import { addDays, format } from 'date-fns'

export type ScanWindow = 'w1' | 'w2' | 'month' | 'all' | 'past'

export const DEFAULT_WINDOW: ScanWindow = 'w2'

export const WINDOW_LABELS: Record<ScanWindow, string> = { w1: 'שבוע', w2: 'שבועיים', month: 'חודש', all: 'הכל', past: 'עבר' }

const DAYS: Partial<Record<ScanWindow, number>> = { w1: 7, w2: 14, month: 30 }

/** the last day of a forward window (today included), '' for the windows without one */
export function windowEnd(w: ScanWindow, today: string): string {
  const n = DAYS[w]
  return n ? format(addDays(new Date(`${today}T12:00:00`), n), 'yyyy-MM-dd') : ''
}

type Scan = { surgery_date: string | null; status: string; patient_name?: string }

/**
 * Does the scan belong to the window? A forward window holds the planned surgeries whose date is today or later and up to its end
 * (done, cancelled and postponed ones are not part of the coming weeks); "past" holds every surgery before today; "all" holds everything.
 */
export function inWindow(s: Scan, w: ScanWindow, today: string): boolean {
  if (w === 'all') return true
  if (w === 'past') return !!s.surgery_date && s.surgery_date < today
  if (s.status !== 'planned' || !s.surgery_date) return false
  return s.surgery_date >= today && s.surgery_date <= windowEnd(w, today)
}

/** nearest surgery first (the past window: the latest first); scans without a date at the end */
export function compareByWindow(w: ScanWindow) {
  return (a: Scan, b: Scan): number => {
    if (!a.surgery_date || !b.surgery_date) return a.surgery_date ? -1 : b.surgery_date ? 1 : (a.patient_name ?? '').localeCompare(b.patient_name ?? '', 'he')
    const c = a.surgery_date.localeCompare(b.surgery_date)
    return (w === 'past' ? -c : c) || (a.patient_name ?? '').localeCompare(b.patient_name ?? '', 'he')
  }
}

/** a short line under the filters: what the screen is showing */
export function windowSummary(w: ScanWindow, today: string): string {
  if (w === 'all') return 'כל הסריקות, מהניתוח הקרוב אל הרחוק'
  if (w === 'past') return 'ניתוחים שהיו, האחרון קודם'
  const end = windowEnd(w, today)
  return `ניתוחים מתוכננים עד ${end.slice(8, 10)}/${end.slice(5, 7)}, לפי סדר הניתוח`
}
