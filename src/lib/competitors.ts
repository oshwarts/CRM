import { addDays, format } from 'date-fns'
import type { CompetitorIntelRow } from './types'
import { daysUntil, todayISO } from './utils'

export const OUTCOME_LABELS: Record<string, string> = { open: 'פתוח', won: 'ניצחנו', lost: 'הפסדנו' }
export const OUTCOME_TONE: Record<string, string> = {
  open: 'border-slate-200 bg-slate-50 text-slate-600',
  won: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  lost: 'border-red-200 bg-red-50 text-red-600',
}

/** why a deal was lost (a fixed list, so that the report can count them) */
export const LOSS_REASONS = ['מחיר', 'יחסים / נאמנות לרופא', 'מוצר / טכנולוגיה', 'מכרז / חוזה קיים', 'זמינות / שירות', 'אחר'] as const

/** the doctor's attitude to the competitor he works with now */
export const LOYALTY_LABELS: Record<string, string> = {
  loyal: 'נאמן למתחרה',
  open: 'פתוח למעבר',
  leaning: 'נוטה אלינו',
}
export const LOYALTY_TONE: Record<string, string> = {
  loyal: 'border-red-200 bg-red-50 text-red-600',
  open: 'border-amber-200 bg-amber-50 text-amber-700',
  leaning: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

/** a record that nobody updated for this long (and is still open) is probably out of date */
export const STALE_DAYS = 90
export const isStale = (i: Pick<CompetitorIntelRow, 'intel_date' | 'outcome'>) => i.outcome === 'open' && (daysUntil(i.intel_date) ?? 0) < -STALE_DAYS

export type CompetitorAlert = {
  key: string
  kind: 'contract' | 'tender'
  intel: CompetitorIntelRow
  date: string
  days: number
}

/**
 * Opportunities: a competitor's contract that ends, or a tender that closes, within the next `within` days.
 * `hospitalIds` = the hospitals of the agent; managers (or an agent without hospitals) see everything.
 */
export function competitorAlerts(list: CompetitorIntelRow[], hospitalIds: string[] | null, within = 90): CompetitorAlert[] {
  const today = todayISO()
  const limit = format(addDays(new Date(), within), 'yyyy-MM-dd')
  const mine = (i: CompetitorIntelRow) => !hospitalIds || hospitalIds.length === 0 || !i.hospital_id || hospitalIds.includes(i.hospital_id)
  const out: CompetitorAlert[] = []
  for (const i of list) {
    if (i.outcome === 'won' || !mine(i)) continue
    if (i.contract_end && i.contract_end >= today && i.contract_end <= limit) out.push({ key: `c${i.id}`, kind: 'contract', intel: i, date: i.contract_end, days: daysUntil(i.contract_end) ?? 0 })
    if (i.tender_due && i.tender_due >= today && i.tender_due <= limit) out.push({ key: `t${i.id}`, kind: 'tender', intel: i, date: i.tender_due, days: daysUntil(i.tender_due) ?? 0 })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/** records added in the last week at the agent's hospitals by somebody else */
export function newActivity(list: CompetitorIntelRow[], hospitalIds: string[] | null, myId: string | undefined, days = 7): CompetitorIntelRow[] {
  const since = Date.now() - days * 86400000
  return list.filter((i) => new Date(i.created_at).getTime() >= since && i.created_by !== myId && (!hospitalIds || hospitalIds.length === 0 || (!!i.hospital_id && hospitalIds.includes(i.hospital_id))))
}

export const money = (n: number | null | undefined) => (n === null || n === undefined ? '' : `₪${Math.round(n).toLocaleString('he-IL')}`)
