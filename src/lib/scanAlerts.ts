import type { PatientScanRow } from './types'
import { daysUntil } from './utils'

/** what is still open for a scan whose CT date falls in the coming 7 days */
export function weekMissing(s: PatientScanRow): string[] {
  if (s.status === 'cancelled' || !s.ct_date) return []
  const d = daysUntil(s.ct_date)
  if (d === null || d < 0 || d > 7) return []
  const out: string[] = []
  if (!s.scanned) out.push('CT טרם בוצע')
  else if (!s.disk_collected) out.push('דיסק לא נאסף')
  if (!s.plan_ready) out.push('תוכנית לא מוכנה')
  return out
}

export function rowFlags(s: PatientScanRow) {
  const active = s.status !== 'cancelled'
  const surgerySoon = !!s.surgery_date && (daysUntil(s.surgery_date) ?? -1) >= 0 && (daysUntil(s.surgery_date) ?? 99) <= 7
  const ctDays = s.ct_date ? daysUntil(s.ct_date) : null
  return {
    overdueRow: active && ctDays !== null && ctDays < 0 && !s.scanned,
    soon: ctDays !== null && ctDays >= 0 && ctDays <= 3 && !s.scanned,
    noCtSoon: active && surgerySoon && !s.ct_date,
    noDiskSoon: active && surgerySoon && !!s.ct_date && !s.disk_collected,
    missing: weekMissing(s),
    rescanKind: rescanAlert(s),
    hasEvents: !!s.ct_date || (s.rescan && !!s.rescan_date),
  }
}

export type RescanKind = 'today' | 'soon' | 'overdue' | 'nodate'

/** an open re-scan that needs the agent to make sure the patient shows up */
export function rescanAlert(s: PatientScanRow): RescanKind | null {
  if (s.status === 'cancelled' || !s.rescan || s.rescan_done) return null
  if (!s.rescan_date) return 'nodate'
  const d = daysUntil(s.rescan_date)
  if (d === null || d > 7) return null
  if (d < 0) return 'overdue'
  return d === 0 ? 'today' : 'soon'
}
