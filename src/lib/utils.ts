import { addDays, format, isBefore, isValid, parseISO, startOfDay } from 'date-fns'

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function plusDaysISO(days: number): string {
  return format(addDays(new Date(), days), 'yyyy-MM-dd')
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return ''
  const d = parseISO(value)
  return isValid(d) ? format(d, 'dd/MM/yyyy') : ''
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return ''
  return value.slice(0, 5)
}

/** overdue = date strictly before today */
export function isOverdue(value: string | null | undefined): boolean {
  if (!value) return false
  const d = parseISO(value)
  return isValid(d) && isBefore(startOfDay(d), startOfDay(new Date()))
}

export function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null
  const d = parseISO(value)
  if (!isValid(d)) return null
  const diff = startOfDay(d).getTime() - startOfDay(new Date()).getTime()
  return Math.round(diff / 86400000)
}

export function classNames(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

/**
 * One cell of a CSV file. A text that starts with = + - @ would be run as a formula by Excel (CSV injection, e.g. a doctor
 * named "=HYPERLINK(…)"): it gets a leading apostrophe. Plain numbers are left alone.
 */
export function csvCell(v: unknown): string {
  let s = String(v ?? '')
  if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s) && !/^[+-]?\d+([.,]\d+)?$/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * An ID or a phone number that Excel must keep as text (it would drop the leading zero of 037372901). Written as ="037372901":
 * only for a string of digits, dashes and spaces (a phone may start with +), which cannot be a formula. Anything else goes through csvCell.
 */
export function csvTextDigits(v: unknown): string {
  const s = String(v ?? '').trim()
  return /^\+?[\d\- ]*\d[\d\- ]*$/.test(s) ? `="${s}"` : csvCell(v)
}
