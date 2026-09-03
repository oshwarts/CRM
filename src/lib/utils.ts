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
