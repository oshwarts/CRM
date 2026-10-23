// The rules of the investigations screens: categories, severity, how old an open investigation is, filtering and counting.
// No data access here.

export const CATEGORIES = [
  'כוח אדם / הכשרות',
  'טעות אנוש',
  'חומרים / מוצרים / אריזה',
  'מערכות קריטיות / תחזוקה',
  'תנאים סביבתיים',
  'תהליך / שיטה',
  'מכשור / מדידות / בדיקות',
  'תיעוד / מסמכים',
  'אחר',
] as const

export const SEVERITY_LABELS: Record<number, string> = { 1: 'נמוכה', 2: 'בינונית', 3: 'גבוהה' }

/** an open investigation is "late" after this many days, "very late" after the second number */
export const LATE_DAYS = 14
export const VERY_LATE_DAYS = 30

export type InvLike = {
  event_date: string
  status: 'open' | 'closed'
  closed_on: string | null
  severity: number
  title: string
  problem: string
  root_cause: string
  solution: string
  product: string
  categories: string[]
  hospital_id: string | null
  doctors: { id: string; name: string }[]
  contacts: { id: string; name: string }[]
  staff: { id: string; full_name: string }[]
}

const dayMs = 86400000
export const daysBetween = (from: string, to: string) => Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / dayMs)

/** how many days an open investigation has been open (a closed one: how long it took) */
export function ageDays(i: Pick<InvLike, 'event_date' | 'status' | 'closed_on'>, today: string): number {
  return Math.max(0, daysBetween(i.event_date, i.status === 'closed' && i.closed_on ? i.closed_on : today))
}

export type Lateness = 'ok' | 'late' | 'very-late'
export function lateness(i: Pick<InvLike, 'event_date' | 'status' | 'closed_on'>, today: string): Lateness {
  if (i.status !== 'open') return 'ok'
  const n = ageDays(i, today)
  return n >= VERY_LATE_DAYS ? 'very-late' : n >= LATE_DAYS ? 'late' : 'ok'
}

export type InvFilters = {
  status: 'open' | 'closed' | 'all'
  q: string
  doctorId: string
  hospitalId: string
  category: string
  severity: number // 0 = all
  lateOnly: boolean
}

export const noFilters: InvFilters = { status: 'open', q: '', doctorId: '', hospitalId: '', category: '', severity: 0, lateOnly: false }

const norm = (s: string) => s.toLowerCase().replace(/["'׳״.]/g, '').replace(/\s+/g, ' ').trim()

export function filterInvestigations<T extends InvLike>(list: T[], f: InvFilters, today: string): T[] {
  const words = norm(f.q).split(' ').filter(Boolean)
  return list.filter((i) => {
    if (f.status !== 'all' && i.status !== f.status) return false
    if (f.doctorId && !i.doctors.some((d) => d.id === f.doctorId)) return false
    if (f.hospitalId && i.hospital_id !== f.hospitalId) return false
    if (f.category && !i.categories.includes(f.category)) return false
    if (f.severity && i.severity !== f.severity) return false
    if (f.lateOnly && lateness(i, today) === 'ok') return false
    if (words.length) {
      const hay = norm([i.title, i.problem, i.root_cause, i.solution, i.product, ...i.doctors.map((d) => d.name), ...i.contacts.map((c) => c.name), ...i.staff.map((s) => s.full_name)].join(' '))
      if (!words.every((w) => hay.includes(w))) return false
    }
    return true
  })
}

/** open ones first: the most severe, then the oldest; closed ones after them, the latest first */
export function sortInvestigations<T extends InvLike>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'open' ? -1 : 1
    if (a.status === 'open') return b.severity - a.severity || a.event_date.localeCompare(b.event_date)
    return (b.closed_on ?? b.event_date).localeCompare(a.closed_on ?? a.event_date)
  })
}

export type InvStats = { open: number; closed: number; late: number; high: number; byCategory: { category: string; count: number }[] }

export function investigationStats(list: InvLike[], today: string): InvStats {
  const by = new Map<string, number>()
  for (const i of list) for (const c of i.categories) by.set(c, (by.get(c) ?? 0) + 1)
  return {
    open: list.filter((i) => i.status === 'open').length,
    closed: list.filter((i) => i.status === 'closed').length,
    late: list.filter((i) => lateness(i, today) !== 'ok').length,
    high: list.filter((i) => i.status === 'open' && i.severity === 3).length,
    byCategory: [...by.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count || a.category.localeCompare(b.category, 'he')),
  }
}

/** an investigation may be closed only when the problem is understood and solved */
export function closeBlocker(i: { problem: string; root_cause: string; solution: string; openActions: number }): string {
  if (!i.problem.trim()) return 'תאר מה הייתה הבעיה'
  if (!i.root_cause.trim() || !i.solution.trim()) return 'כדי לסגור תחקיר צריך למלא גם שורש הבעיה וגם פתרון'
  if (i.openActions > 0) return i.openActions === 1 ? 'יש פעולה מתקנת אחת שעוד לא בוצעה' : `יש ${i.openActions} פעולות מתקנות שעוד לא בוצעו`
  return ''
}
