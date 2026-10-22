import { format, isValid, parseISO } from 'date-fns'

/** the LOCAL calendar day (yyyy-mm-dd) of a timestamp: `iso.slice(0, 10)` would give the UTC day, a day early for something done after midnight in Israel */
export function localDay(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = parseISO(iso)
  return isValid(d) ? format(d, 'yyyy-MM-dd') : null
}
