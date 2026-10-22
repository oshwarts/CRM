// What the scans screen shows when it opens: the surgeries of the next one or two weeks, nearest first, and not the old ones that were done.
import { addDays, format } from 'date-fns'
import { matchesWords, searchKey, searchWords } from './contactMatch'

export type ScanWindow = 'w1' | 'w2' | 'month' | 'all' | 'past'

export const DEFAULT_WINDOW: ScanWindow = 'w2'

export const WINDOW_LABELS: Record<ScanWindow, string> = { w1: 'שבוע', w2: 'שבועיים', month: 'חודש', all: 'הכל', past: 'עבר' }

const DAYS: Partial<Record<ScanWindow, number>> = { w1: 7, w2: 14, month: 30 }

/** the last day of a forward window (today included), '' for the windows without one */
export function windowEnd(w: ScanWindow, today: string): string {
  const n = DAYS[w]
  return n ? format(addDays(new Date(`${today}T12:00:00`), n), 'yyyy-MM-dd') : ''
}

/** what a link to the screen asks for: /scans?hospital=<id>&window=all&highlight=<scanId> */
export function parseScanParams(params: URLSearchParams): { hospital: string; window: ScanWindow; highlight: string } {
  const hospital = params.get('hospital') ?? ''
  const w = params.get('window') ?? ''
  // from a hospital the screen opens on the coming month; an explicit window (w1 / w2 / month / all / past) wins
  const window = Object.prototype.hasOwnProperty.call(WINDOW_LABELS, w) ? (w as ScanWindow) : hospital ? 'month' : DEFAULT_WINDOW
  return { hospital, window, highlight: params.get('highlight') ?? '' }
}

/** the view that shows a scan a link points at: its hospital, and a window that holds its date (the whole list when it is not in the asked one) */
export function revealScan(
  s: { hospital_id: string; surgery_date: string | null; status: string },
  view: { hospital: string; window: ScanWindow },
  today: string,
): { hospital: string; window: ScanWindow } {
  return {
    hospital: view.hospital && view.hospital !== s.hospital_id ? '' : view.hospital,
    window: inWindow(s, view.window, today) ? view.window : 'all',
  }
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

type Searchable = {
  patient_name: string
  patient_id_number: string
  patient_phone: string
  surgeon?: { name: string } | null
  hospital?: { name: string } | null
}

/**
 * The search box: every word typed must be found in the patient's name, the surgeon or the hospital (niqqud, quotes and final letters ignored,
 * like everywhere else in the app), or — for a word of digits — in the ID number or the phone (dashes and spaces in the phone are ignored).
 */
export function matchesScanQuery(s: Searchable, q: string): boolean {
  const words = searchWords(q)
  if (words.length === 0) return true
  const text = searchKey(`${s.patient_name} ${s.surgeon?.name ?? ''} ${s.hospital?.name ?? ''}`)
  const digits = `${s.patient_id_number.replace(/\D/g, '')} ${s.patient_phone.replace(/\D/g, '')}`
  return words.every((w) => (/^\d+$/.test(w) ? digits.includes(w) : matchesWords([w], text)))
}

/** a short line under the filters: what the screen is showing */
export function windowSummary(w: ScanWindow, today: string): string {
  if (w === 'all') return 'כל הסריקות, מהניתוח הקרוב אל הרחוק'
  if (w === 'past') return 'ניתוחים שהיו, האחרון קודם'
  const end = windowEnd(w, today)
  return `ניתוחים מתוכננים עד ${end.slice(8, 10)}/${end.slice(5, 7)}, לפי סדר הניתוח`
}
