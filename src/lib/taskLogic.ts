// Pure logic of the tasks screen (kept apart from the page so that it can be tested without a browser).
import { addDays, addMonths, format, isValid, parseISO, startOfDay } from 'date-fns'

export type Bucket = 'overdue' | 'today' | 'week' | 'later' | 'none'

/** whole local days from `today` to the date (negative = past); null for no / invalid date */
export function daysFrom(due: string | null | undefined, today: Date = new Date()): number | null {
  if (!due) return null
  const d = parseISO(due)
  if (!isValid(d)) return null
  return Math.round((startOfDay(d).getTime() - startOfDay(today).getTime()) / 86400000)
}

export function bucketOf(due: string | null | undefined, today: Date = new Date()): Bucket {
  const d = daysFrom(due, today)
  if (d === null) return 'none'
  if (d < 0) return 'overdue'
  if (d === 0) return 'today'
  if (d <= 7) return 'week'
  return 'later'
}

const WEEKDAY = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

/** "היום", "מחר", "אתמול", "לפני 3 ימים", "יום ג׳ 22/10" (within the week), otherwise dd/MM/yyyy */
export function dueLabel(due: string | null | undefined, today: Date = new Date()): string {
  const d = daysFrom(due, today)
  if (d === null || !due) return ''
  if (d === 0) return 'היום'
  if (d === 1) return 'מחר'
  if (d === -1) return 'אתמול'
  const date = parseISO(due)
  if (d < 0 && d >= -30) return `לפני ${-d} ימים · ${format(date, 'dd/MM')}`
  if (d > 1 && d <= 6) return `יום ${WEEKDAY[date.getDay()]} ${format(date, 'dd/MM')}`
  return format(date, 'dd/MM/yyyy')
}

type SortKey = { priority: string; due_date: string | null; created_at: string }

/** urgent first, then the nearest date (no date last), then the newest */
export function compareOpen(a: SortKey, b: SortKey): number {
  const u = Number(b.priority === 'urgent') - Number(a.priority === 'urgent')
  if (u) return u
  if (a.due_date !== b.due_date) {
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return a.due_date < b.due_date ? -1 : 1
  }
  return (b.created_at ?? '').localeCompare(a.created_at ?? '')
}

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

/** date of the next occurrence of a repeating task (counted from the later of due date and today); month ends are clamped (31 Jan → 28 Feb) */
export function nextDue(due: string, recurrence: string, today: Date = new Date()): string {
  const base = startOfDay(parseISO(due))
  const t = startOfDay(today)
  const from = base > t ? base : t
  return iso(recurrence === 'weekly' ? addDays(from, 7) : addMonths(from, 1))
}

/** a Hebrew message for a failed task write (the database's own text is English and means nothing to the user) */
export function taskError(e: unknown, fallback: string): string {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : ''
  if (/row-level security|permission denied|not authorized|jwt/i.test(msg)) return 'אין לך הרשאה לבצע את הפעולה הזו'
  return /[א-ת]/.test(msg) ? msg : fallback
}

/**
 * A uuid-shaped id that depends only on the text (128 bits from four 32-bit hashes). The "next copy" of a repeating task gets
 * the id of its source task this way, so completing the same task twice (reopened, a retry, an offline replay) can only ever
 * name one copy.
 */
export function stableUuid(seed: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x9e3779b9, h4 = 0x85ebca6b
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
    h3 = Math.imul(h3 ^ c, 2246822519)
    h4 = Math.imul(h4 ^ c, 3266489917)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h3 ^ (h3 >>> 13), 3266489909)
  h3 = Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^ Math.imul(h4 ^ (h4 >>> 13), 3266489909)
  h4 = Math.imul(h4 ^ (h4 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  const hex = [h1, h2, h3, h4].map((n) => (n >>> 0).toString(16).padStart(8, '0')).join('')
  // version 4 / variant bits so that the database accepts it as a uuid
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${'89ab'[parseInt(hex[16], 16) & 3]}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/** the id of the copy a repeating task makes when it is completed */
export const nextCopyId = (sourceId: string) => stableUuid(`next-copy:${sourceId}`)
